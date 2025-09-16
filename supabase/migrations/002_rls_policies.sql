-- =============================================================================
-- POLITIQUES DE SÉCURITÉ RLS - ZUA PRESSING
-- =============================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE pressings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_queue ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- FONCTIONS HELPER POUR LES POLITIQUES
-- =============================================================================

-- Fonction pour obtenir l'ID du pressing de l'utilisateur connecté
CREATE OR REPLACE FUNCTION auth.user_pressing_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT pressing_id 
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si l'utilisateur est propriétaire
CREATE OR REPLACE FUNCTION auth.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'owner'
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si l'utilisateur a une permission spécifique
CREATE OR REPLACE FUNCTION auth.has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT 
            CASE 
                WHEN role = 'owner' THEN true
                ELSE EXISTS (
                    SELECT 1 
                    FROM jsonb_array_elements(permissions) AS perm
                    WHERE perm->>'action' = permission_name 
                      AND (perm->>'granted')::boolean = true
                )
            END
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si l'utilisateur est actif
CREATE OR REPLACE FUNCTION auth.is_active_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT is_active = true
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- POLITIQUES POUR TABLE PRESSINGS
-- =============================================================================

-- Les utilisateurs peuvent voir seulement leur pressing
CREATE POLICY "Users can view their own pressing"
    ON pressings FOR SELECT
    USING (
        id = auth.user_pressing_id()
        AND auth.is_active_user()
    );

-- Seuls les propriétaires peuvent modifier leur pressing
CREATE POLICY "Owners can update their pressing"
    ON pressings FOR UPDATE
    USING (
        id = auth.user_pressing_id()
        AND auth.is_owner()
        AND auth.is_active_user()
    );

-- =============================================================================
-- POLITIQUES POUR TABLE USERS
-- =============================================================================

-- Les utilisateurs peuvent voir les autres utilisateurs de leur pressing
CREATE POLICY "Users can view pressing members"
    ON users FOR SELECT
    USING (
        pressing_id = auth.user_pressing_id()
        AND auth.is_active_user()
    );

-- Les utilisateurs peuvent modifier leur propre profil
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (
        id = auth.uid()
        AND auth.is_active_user()
    );

-- Seuls les propriétaires peuvent gérer les autres utilisateurs
CREATE POLICY "Owners can manage users"
    ON users FOR ALL
    USING (
        pressing_id = auth.user_pressing_id()
        AND auth.is_owner()
        AND auth.has_permission('manage_users')
        AND auth.is_active_user()
    );

-- Les nouveaux utilisateurs peuvent s'insérer eux-mêmes
CREATE POLICY "Users can insert themselves"
    ON users FOR INSERT
    WITH CHECK (
        id = auth.uid()
    );

-- =============================================================================
-- POLITIQUES POUR TABLE USER_PREFERENCES
-- =============================================================================

-- Les utilisateurs peuvent gérer leurs propres préférences
CREATE POLICY "Users can manage own preferences"
    ON user_preferences FOR ALL
    USING (
        user_id = auth.uid()
        AND auth.is_active_user()
    );

-- =============================================================================
-- POLITIQUES POUR TABLE ARTICLES
-- =============================================================================

-- Tous les utilisateurs actifs peuvent voir les articles de leur pressing
CREATE POLICY "Users can view pressing articles"
    ON articles FOR SELECT
    USING (
        pressing_id = auth.user_pressing_id()
        AND auth.is_active_user()
    );

-- Seuls les utilisateurs avec permission peuvent créer des articles
CREATE POLICY "Authorized users can create articles"
    ON articles FOR INSERT
    WITH CHECK (
        pressing_id = auth.user_pressing_id()
        AND (auth.is_owner() OR auth.has_permission('modify_prices'))
        AND auth.is_active_user()
    );

-- Seuls les utilisateurs avec permission peuvent modifier les articles
CREATE POLICY "Authorized users can update articles"
    ON articles FOR UPDATE
    USING (
        pressing_id = auth.user_pressing_id()
        AND (auth.is_owner() OR auth.has_permission('modify_prices'))
        AND auth.is_active_user()
    );

-- Seuls les propriétaires peuvent supprimer des articles
CREATE POLICY "Owners can delete articles"
    ON articles FOR DELETE
    USING (
        pressing_id = auth.user_pressing_id()
        AND auth.is_owner()
        AND auth.is_active_user()
    );

-- =============================================================================
-- POLITIQUES POUR TABLE INVOICES
-- =============================================================================

-- Tous les utilisateurs actifs peuvent voir les factures de leur pressing
CREATE POLICY "Users can view pressing invoices"
    ON invoices FOR SELECT
    USING (
        pressing_id = auth.user_pressing_id()
        AND auth.is_active_user()
    );

-- Les utilisateurs avec permission peuvent créer des factures
CREATE POLICY "Authorized users can create invoices"
    ON invoices FOR INSERT
    WITH CHECK (
        pressing_id = auth.user_pressing_id()
        AND auth.has_permission('create_invoice')
        AND created_by = auth.uid()
        AND auth.is_active_user()
    );

-- Les utilisateurs peuvent modifier les factures selon leurs permissions
CREATE POLICY "Users can update invoices based on permissions"
    ON invoices FOR UPDATE
    USING (
        pressing_id = auth.user_pressing_id()
        AND (
            -- Le créateur peut toujours modifier sa facture (sauf si annulée)
            (created_by = auth.uid() AND status != 'cancelled')
            OR 
            -- Ou l'utilisateur a la permission de modifier les factures
            auth.is_owner()
            OR
            auth.has_permission('cancel_invoice')
        )
        AND auth.is_active_user()
    );

-- Seuls les propriétaires peuvent supprimer des factures (soft delete via status)
CREATE POLICY "Owners can cancel invoices"
    ON invoices FOR UPDATE
    USING (
        pressing_id = auth.user_pressing_id()
        AND (auth.is_owner() OR auth.has_permission('cancel_invoice'))
        AND auth.is_active_user()
    );

-- =============================================================================
-- POLITIQUES POUR TABLE CLIENTS
-- =============================================================================

-- Tous les utilisateurs actifs peuvent voir les clients de leur pressing
CREATE POLICY "Users can view pressing clients"
    ON clients FOR SELECT
    USING (
        pressing_id = auth.user_pressing_id()
        AND auth.is_active_user()
    );

-- Les clients sont créés/modifiés automatiquement via triggers
CREATE POLICY "System can manage clients"
    ON clients FOR ALL
    USING (
        pressing_id = auth.user_pressing_id()
        AND auth.is_active_user()
    );

-- =============================================================================
-- POLITIQUES POUR TABLE REVENUE_DAILY
-- =============================================================================

-- Seuls les utilisateurs avec permission peuvent voir les revenus
CREATE POLICY "Authorized users can view revenue"
    ON revenue_daily FOR SELECT
    USING (
        pressing_id = auth.user_pressing_id()
        AND (auth.is_owner() OR auth.has_permission('view_revenue'))
        AND auth.is_active_user()
    );

-- Les revenus sont calculés automatiquement via fonctions
CREATE POLICY "System can manage revenue"
    ON revenue_daily FOR ALL
    USING (
        pressing_id = auth.user_pressing_id()
        AND (auth.is_owner() OR auth.has_permission('view_revenue'))
        AND auth.is_active_user()
    );

-- =============================================================================
-- POLITIQUES POUR TABLE AUDIT_LOGS
-- =============================================================================

-- Seuls les propriétaires peuvent voir les logs d'audit
CREATE POLICY "Owners can view audit logs"
    ON audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
              AND u.pressing_id = (
                  SELECT pressing_id FROM users 
                  WHERE id = audit_logs.user_id
              )
              AND u.role = 'owner'
              AND u.is_active = true
        )
    );

-- Les logs sont créés automatiquement via triggers
CREATE POLICY "System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true); -- Les triggers gèrent la sécurité

-- =============================================================================
-- POLITIQUES POUR TABLE OFFLINE_QUEUE
-- =============================================================================

-- Les utilisateurs peuvent gérer leur propre queue offline
CREATE POLICY "Users can manage own offline queue"
    ON offline_queue FOR ALL
    USING (
        user_id = auth.uid()
        AND auth.is_active_user()
    );

-- =============================================================================
-- POLITIQUES POUR LES VUES
-- =============================================================================

-- Les vues héritent automatiquement des politiques des tables sous-jacentes
-- mais nous pouvons ajouter des restrictions supplémentaires si nécessaire

-- =============================================================================
-- GRANTS ET PERMISSIONS
-- =============================================================================

-- Donner les permissions nécessaires aux utilisateurs authentifiés
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Donner les permissions pour les utilisateurs anonymes (très limitées)
GRANT USAGE ON SCHEMA public TO anon;

-- Permissions spéciales pour les fonctions de service
GRANT EXECUTE ON FUNCTION calculate_daily_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION get_invoice_stats TO authenticated;
GRANT EXECUTE ON FUNCTION search_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number TO authenticated;
GRANT EXECUTE ON FUNCTION update_client_stats TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_articles TO authenticated;

-- Permissions pour les fonctions d'authentification
GRANT EXECUTE ON FUNCTION auth.user_pressing_id TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_owner TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_permission TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_active_user TO authenticated;

-- =============================================================================
-- COMMENTAIRES POUR LA DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY "Users can view their own pressing" ON pressings 
IS 'Les utilisateurs ne peuvent voir que leur propre pressing';

COMMENT ON POLICY "Users can view pressing invoices" ON invoices 
IS 'Les utilisateurs peuvent voir toutes les factures de leur pressing';

COMMENT ON POLICY "Authorized users can create invoices" ON invoices 
IS 'Seuls les utilisateurs avec la permission create_invoice peuvent créer des factures';

COMMENT ON POLICY "Owners can view audit logs" ON audit_logs 
IS 'Seuls les propriétaires peuvent consulter les logs d''audit';

COMMENT ON FUNCTION auth.user_pressing_id() 
IS 'Retourne l''ID du pressing de l''utilisateur connecté';

COMMENT ON FUNCTION auth.is_owner() 
IS 'Vérifie si l''utilisateur connecté est propriétaire';

COMMENT ON FUNCTION auth.has_permission(TEXT) 
IS 'Vérifie si l''utilisateur connecté a une permission spécifique';