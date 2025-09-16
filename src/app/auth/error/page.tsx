'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  LogIn, 
  Mail,
  Shield,
  Clock,
  Ban,
  Wifi,
  Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth, useAuthActions } from '@/store/auth';

// Types d'erreurs d'authentification
const ERROR_TYPES = {
  // Erreurs Supabase courantes
  'invalid_credentials': {
    title: 'Identifiants incorrects',
    description: 'L\'email ou le mot de passe saisi est incorrect.',
    icon: Shield,
    color: 'text-red-600',
    suggestions: [
      'Vérifiez votre adresse email',
      'Vérifiez votre mot de passe (attention aux majuscules)',
      'Utilisez "Mot de passe oublié" si nécessaire'
    ],
    actions: [
      { label: 'Réessayer', href: '/auth/login', primary: true },
      { label: 'Mot de passe oublié', href: '/auth/forgot-password', primary: false }
    ]
  },
  'email_not_confirmed': {
    title: 'Email non confirmé',
    description: 'Vous devez confirmer votre adresse email avant de vous connecter.',
    icon: Mail,
    color: 'text-amber-600',
    suggestions: [
      'Vérifiez votre boîte email (y compris les spams)',
      'Cliquez sur le lien de confirmation reçu',
      'Demandez un nouvel email de confirmation'
    ],
    actions: [
      { label: 'Renvoyer l\'email', href: '/auth/resend-confirmation', primary: true },
      { label: 'Retour à la connexion', href: '/auth/login', primary: false }
    ]
  },
  'signup_disabled': {
    title: 'Inscriptions fermées',
    description: 'Les nouvelles inscriptions sont temporairement suspendues.',
    icon: Ban,
    color: 'text-red-600',
    suggestions: [
      'Contactez l\'administrateur pour plus d\'informations',
      'Réessayez plus tard',
      'Vérifiez les annonces sur notre site'
    ],
    actions: [
      { label: 'Retour à l\'accueil', href: '/', primary: true },
      { label: 'Nous contacter', href: '/contact', primary: false }
    ]
  },
  'too_many_requests': {
    title: 'Trop de tentatives',
    description: 'Vous avez effectué trop de tentatives de connexion. Attendez quelques minutes.',
    icon: Clock,
    color: 'text-amber-600',
    suggestions: [
      'Attendez 5-10 minutes avant de réessayer',
      'Vérifiez vos identifiants avant la prochaine tentative',
      'Contactez le support si le problème persiste'
    ],
    actions: [
      { label: 'Réessayer dans 5 min', href: '/auth/login', primary: true }
    ]
  },
  'account_locked': {
    title: 'Compte suspendu',
    description: 'Votre compte a été temporairement suspendu.',
    icon: Ban,
    color: 'text-red-600',
    suggestions: [
      'Contactez votre administrateur pressing',
      'Vérifiez vos emails pour plus d\'informations',
      'Respectez les conditions d\'utilisation'
    ],
    actions: [
      { label: 'Contacter l\'administrateur', href: '/contact', primary: true }
    ]
  },
  'network_error': {
    title: 'Problème de connexion',
    description: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
    icon: Wifi,
    color: 'text-amber-600',
    suggestions: [
      'Vérifiez votre connexion internet',
      'Réessayez dans quelques instants',
      'Contactez votre fournisseur internet si nécessaire'
    ],
    actions: [
      { label: 'Réessayer', href: '/auth/login', primary: true }
    ]
  },
  'server_error': {
    title: 'Erreur serveur',
    description: 'Une erreur technique est survenue sur nos serveurs.',
    icon: Server,
    color: 'text-red-600',
    suggestions: [
      'Réessayez dans quelques minutes',
      'Le problème sera résolu dans les plus brefs délais',
      'Contactez le support si cela persiste'
    ],
    actions: [
      { label: 'Réessayer', href: '/auth/login', primary: true },
      { label: 'État du système', href: '/status', primary: false }
    ]
  },
  'session_expired': {
    title: 'Session expirée',
    description: 'Votre session a expiré. Veuillez vous reconnecter.',
    icon: Clock,
    color: 'text-amber-600',
    suggestions: [
      'Reconnectez-vous avec vos identifiants',
      'Cochez "Se souvenir de moi" pour éviter cela',
      'Vos données sont conservées en sécurité'
    ],
    actions: [
      { label: 'Se reconnecter', href: '/auth/login', primary: true }
    ]
  },
  'permission_denied': {
    title: 'Accès refusé',
    description: 'Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource.',
    icon: Shield,
    color: 'text-red-600',
    suggestions: [
      'Contactez votre administrateur pour obtenir les permissions',
      'Vérifiez que vous utilisez le bon compte',
      'Certaines fonctions sont réservées aux propriétaires'
    ],
    actions: [
      { label: 'Tableau de bord', href: '/dashboard', primary: true },
      { label: 'Changer de compte', href: '/auth/login', primary: false }
    ]
  }
};

type ErrorType = keyof typeof ERROR_TYPES;

export default function AuthErrorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearError } = useAuthActions();
  
  const errorParam = searchParams.get('error') as ErrorType;
  const errorDescription = searchParams.get('error_description');
  const [retryCount, setRetryCount] = useState(0);

  // Nettoyer les erreurs du store au montage
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Déterminer le type d'erreur
  const getErrorInfo = () => {
    // Erreur spécifique trouvée
    if (errorParam && ERROR_TYPES[errorParam]) {
      return ERROR_TYPES[errorParam];
    }

    // Analyser la description d'erreur pour des patterns courants
    if (errorDescription) {
      const desc = errorDescription.toLowerCase();
      
      if (desc.includes('invalid') || desc.includes('wrong') || desc.includes('incorrect')) {
        return ERROR_TYPES.invalid_credentials;
      }
      if (desc.includes('email') && desc.includes('confirm')) {
        return ERROR_TYPES.email_not_confirmed;
      }
      if (desc.includes('too many') || desc.includes('rate limit')) {
        return ERROR_TYPES.too_many_requests;
      }
      if (desc.includes('network') || desc.includes('connection')) {
        return ERROR_TYPES.network_error;
      }
      if (desc.includes('server') || desc.includes('internal')) {
        return ERROR_TYPES.server_error;
      }
    }

    // Erreur générique
    return {
      title: 'Erreur d\'authentification',
      description: errorDescription || 'Une erreur inattendue s\'est produite lors de l\'authentification.',
      icon: AlertTriangle,
      color: 'text-red-600',
      suggestions: [
        'Réessayez dans quelques instants',
        'Vérifiez votre connexion internet',
        'Contactez le support si le problème persiste'
      ],
      actions: [
        { label: 'Réessayer', href: '/auth/login', primary: true },
        { label: 'Accueil', href: '/', primary: false }
      ]
    };
  };

  const errorInfo = getErrorInfo();
  const Icon = errorInfo.icon;

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    const primaryAction = errorInfo.actions.find(action => action.primary);
    if (primaryAction) {
      router.push(primaryAction.href);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo et titre */}
        <div className="text-center space-y-2">
          <div className={`mx-auto w-16 h-16 rounded-xl flex items-center justify-center border-2 ${
            errorInfo.color === 'text-red-600' ? 'bg-red-50 border-red-200' :
            errorInfo.color === 'text-amber-600' ? 'bg-amber-50 border-amber-200' :
            'bg-muted border-border'
          }`}>
            <Icon className={`h-8 w-8 ${errorInfo.color}`} />
          </div>
          <h1 className="text-2xl font-bold">Digit Pressing</h1>
          <p className="text-muted-foreground">
            Une erreur s'est produite
          </p>
        </div>

        {/* Carte d'erreur principale */}
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${errorInfo.color}`}>
              <Icon className="h-5 w-5" />
              {errorInfo.title}
            </CardTitle>
            <CardDescription>
              {errorInfo.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Détails techniques si disponibles */}
            {errorDescription && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">Détails techniques :</div>
                    <div className="text-xs font-mono bg-muted p-2 rounded">
                      {errorDescription}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Suggestions de résolution */}
            <div className="space-y-3">
              <h3 className="font-medium">Que puis-je faire ?</h3>
              <ul className="space-y-2">
                {errorInfo.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                {errorInfo.actions.map((action, index) => (
                  action.primary ? (
                    <Button
                      key={index}
                      className="flex-1"
                      onClick={handleRetry}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {action.label}
                    </Button>
                  ) : (
                    <Button
                      key={index}
                      variant="outline"
                      className="flex-1"
                      asChild
                    >
                      <Link href={action.href}>
                        {action.href === '/' && <Home className="h-4 w-4 mr-2" />}
                        {action.href.includes('login') && <LogIn className="h-4 w-4 mr-2" />}
                        {action.href.includes('forgot') && <Mail className="h-4 w-4 mr-2" />}
                        {action.label}
                      </Link>
                    </Button>
                  )
                ))}
              </div>

              {retryCount > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  Tentatives: {retryCount}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Informations d'aide */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-medium">Besoin d'aide ?</h3>
              <p className="text-sm text-muted-foreground">
                Si le problème persiste, notre équipe de support est là pour vous aider.
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/contact">
                    Contacter le support
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/help">
                    Centre d'aide
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations système */}
        <div className="text-center space-y-1 text-xs text-muted-foreground">
          <div>Digit Pressing v1.0.0</div>
          <div>
            Code d'erreur: {errorParam || 'AUTH_UNKNOWN'} - {new Date().toISOString()}
          </div>
        </div>
      </div>
    </div>
  );
}