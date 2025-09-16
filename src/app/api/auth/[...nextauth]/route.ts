// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    // Authentification par email/mot de passe
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email et mot de passe requis');
        }

        try {
          // Vérifier l'utilisateur dans Supabase
          const { data: user, error } = await supabase
            .from('users')
            .select(`
              id,
              email,
              full_name,
              role,
              pressing_id,
              permissions,
              is_active,
              pressing:pressings(name)
            `)
            .eq('email', credentials.email.toLowerCase())
            .eq('is_active', true)
            .single();

          if (error || !user) {
            throw new Error('Utilisateur non trouvé');
          }

          // Vérifier le mot de passe avec Supabase Auth
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (authError || !authData.user) {
            throw new Error('Identifiants incorrects');
          }

          // Mettre à jour la dernière connexion
          await supabase
            .from('users')
            .update({ 
              last_login: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          return {
            id: user.id,
            email: user.email,
            name: user.full_name,
            role: user.role,
            pressingId: user.pressing_id,
            pressingName: user.pressing?.name || 'Mon Pressing',
            permissions: user.permissions,
            supabaseAccessToken: authData.session?.access_token,
          };
        } catch (error: any) {
          console.error('Erreur d\'authentification:', error);
          throw new Error(error.message || 'Erreur de connexion');
        }
      },
    }),

    // Authentification Google (optionnel)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // Première connexion
      if (user) {
        token.role = user.role;
        token.pressingId = user.pressingId;
        token.pressingName = user.pressingName;
        token.permissions = user.permissions;
        token.supabaseAccessToken = user.supabaseAccessToken;
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.pressingId = token.pressingId as string;
        session.user.pressingName = token.pressingName as string;
        session.user.permissions = token.permissions as any[];
        session.supabaseAccessToken = token.supabaseAccessToken as string;
      }

      return session;
    },

    async signIn({ user, account, profile }) {
      // Connexion Google
      if (account?.provider === 'google') {
        try {
          // Vérifier si l'utilisateur existe déjà
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, is_active')
            .eq('email', user.email!)
            .single();

          if (!existingUser) {
            throw new Error('Compte Google non autorisé. Contactez votre administrateur.');
          }

          if (!existingUser.is_active) {
            throw new Error('Compte désactivé');
          }

          return true;
        } catch (error) {
          console.error('Erreur connexion Google:', error);
          return false;
        }
      }

      return true;
    },
  },

  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 heures
  },

  jwt: {
    maxAge: 24 * 60 * 60, // 24 heures
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
