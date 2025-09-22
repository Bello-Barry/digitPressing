"use strict";
// =============================================================================
// STORE AUTHENTIFICATION - Digit PRESSING
// =============================================================================
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useUserPermissions = exports.useUserPreferences = exports.useAuthActions = exports.useAuth = exports.useAuthStore = void 0;
var zustand_1 = require("zustand");
var middleware_1 = require("zustand/middleware");
var supabase_1 = require("@/lib/supabase");
// Préférences par défaut
var getDefaultPreferences = function () { return ({
    theme: 'system',
    language: 'fr',
    currency: '€',
    timezone: 'Europe/Paris',
    notifications: {
        email: true,
        push: true,
        sound: true,
    },
    dashboard: {
        defaultView: 'today',
        showQuickStats: true,
        showRecentInvoices: true,
    },
}); };
exports.useAuthStore = (0, zustand_1.create)()((0, middleware_1.subscribeWithSelector)((0, middleware_1.persist)(function (set, get) { return ({
    // État initial
    user: null,
    session: null,
    preferences: null,
    isLoading: false,
    isInitialized: false,
    error: null,
    // Actions
    signIn: function (email, password) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data, error, profile, user, session, error_1;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 5, , 6]);
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase.auth.signInWithPassword({
                            email: email.trim().toLowerCase(),
                            password: password,
                        })];
                case 1:
                    _a = _e.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    if (!data.user) {
                        throw new Error('Aucun utilisateur retourné après connexion');
                    }
                    return [4 /*yield*/, (0, supabase_1.getUserProfile)(data.user.id)];
                case 2:
                    profile = _e.sent();
                    if (!profile) {
                        throw new Error('Impossible de récupérer le profil utilisateur');
                    }
                    // Mettre à jour la date de dernière connexion
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .update({
                            last_login: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                            .eq('id', data.user.id)];
                case 3:
                    // Mettre à jour la date de dernière connexion
                    _e.sent();
                    user = {
                        id: profile.id,
                        email: profile.email,
                        role: profile.role,
                        pressingId: profile.pressing_id,
                        fullName: profile.full_name,
                        permissions: profile.permissions || [],
                        createdAt: profile.created_at,
                        lastLogin: new Date().toISOString(),
                        isActive: profile.is_active,
                    };
                    session = {
                        user: user,
                        accessToken: ((_b = data.session) === null || _b === void 0 ? void 0 : _b.access_token) || '',
                        refreshToken: ((_c = data.session) === null || _c === void 0 ? void 0 : _c.refresh_token) || '',
                        expiresAt: ((_d = data.session) === null || _d === void 0 ? void 0 : _d.expires_at) ? new Date(data.session.expires_at * 1000).toISOString() : '',
                    };
                    set({ user: user, session: session, isLoading: false });
                    // Charger les préférences utilisateur
                    return [4 /*yield*/, get().loadUserPreferences()];
                case 4:
                    // Charger les préférences utilisateur
                    _e.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _e.sent();
                    console.error('Erreur lors de la connexion:', error_1);
                    set({
                        error: error_1.message || 'Erreur lors de la connexion',
                        isLoading: false,
                        user: null,
                        session: null
                    });
                    throw error_1;
                case 6: return [2 /*return*/];
            }
        });
    }); },
    signUp: function (email, password, fullName, pressingId) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data, error, profileError, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase.auth.signUp({
                            email: email.trim().toLowerCase(),
                            password: password,
                            options: {
                                data: {
                                    full_name: fullName.trim(),
                                    pressing_id: pressingId,
                                }
                            }
                        })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    if (!data.user) {
                        throw new Error('Aucun utilisateur créé');
                    }
                    if (!(pressingId && data.user.id)) return [3 /*break*/, 3];
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .insert({
                            id: data.user.id,
                            email: email.trim().toLowerCase(),
                            full_name: fullName.trim(),
                            pressing_id: pressingId,
                            role: 'employee',
                            permissions: [
                                { action: 'create_invoice', granted: true },
                                { action: 'view_revenue', granted: false },
                                { action: 'cancel_invoice', granted: false },
                                { action: 'manage_users', granted: false },
                            ],
                            is_active: true,
                        })];
                case 2:
                    profileError = (_b.sent()).error;
                    if (profileError) {
                        console.error('Erreur lors de la création du profil:', profileError);
                    }
                    _b.label = 3;
                case 3:
                    set({ isLoading: false });
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _b.sent();
                    console.error('Erreur lors de l\'inscription:', error_2);
                    set({
                        error: error_2.message || 'Erreur lors de l\'inscription',
                        isLoading: false
                    });
                    throw error_2;
                case 5: return [2 /*return*/];
            }
        });
    }); },
    signOut: function () { return __awaiter(void 0, void 0, void 0, function () {
        var error, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase.auth.signOut()];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        throw error;
                    }
                    set({
                        user: null,
                        session: null,
                        preferences: null,
                        isLoading: false,
                        error: null
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error('Erreur lors de la déconnexion:', error_3);
                    set({
                        error: error_3.message || 'Erreur lors de la déconnexion',
                        isLoading: false
                    });
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    resetPassword: function (email) { return __awaiter(void 0, void 0, void 0, function () {
        var error, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
                            redirectTo: "".concat(window.location.origin, "/auth/reset-password"),
                        })];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        throw error;
                    }
                    set({ isLoading: false });
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    console.error('Erreur lors de la réinitialisation:', error_4);
                    set({
                        error: error_4.message || 'Erreur lors de la réinitialisation',
                        isLoading: false
                    });
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    updatePassword: function (newPassword) { return __awaiter(void 0, void 0, void 0, function () {
        var error, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase.auth.updateUser({
                            password: newPassword
                        })];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        throw error;
                    }
                    set({ isLoading: false });
                    return [3 /*break*/, 3];
                case 2:
                    error_5 = _a.sent();
                    console.error('Erreur lors de la mise à jour du mot de passe:', error_5);
                    set({
                        error: error_5.message || 'Erreur lors de la mise à jour du mot de passe',
                        isLoading: false
                    });
                    throw error_5;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    refreshSession: function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data, error, profile, user, session, error_6;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, supabase_1.supabase.auth.refreshSession()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    if (!(data.session && data.user)) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, supabase_1.getUserProfile)(data.user.id)];
                case 2:
                    profile = _b.sent();
                    if (profile) {
                        user = {
                            id: profile.id,
                            email: profile.email,
                            role: profile.role,
                            pressingId: profile.pressing_id,
                            fullName: profile.full_name,
                            permissions: profile.permissions || [],
                            createdAt: profile.created_at,
                            lastLogin: profile.last_login || null,
                            isActive: profile.is_active,
                        };
                        session = {
                            user: user,
                            accessToken: data.session.access_token,
                            refreshToken: data.session.refresh_token,
                            expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
                        };
                        set({ user: user, session: session });
                    }
                    _b.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    error_6 = _b.sent();
                    console.error('Erreur lors du refresh de session:', error_6);
                    // En cas d'erreur de refresh, on déconnecte l'utilisateur
                    set({ user: null, session: null, preferences: null });
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); },
    initialize: function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, session, error, profile, user, authSession, error_7;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    set({ isLoading: true });
                    return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 1:
                    _a = _b.sent(), session = _a.data.session, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    if (!(session === null || session === void 0 ? void 0 : session.user)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, supabase_1.getUserProfile)(session.user.id)];
                case 2:
                    profile = _b.sent();
                    if (!profile) return [3 /*break*/, 4];
                    user = {
                        id: profile.id,
                        email: profile.email,
                        role: profile.role,
                        pressingId: profile.pressing_id,
                        fullName: profile.full_name,
                        permissions: profile.permissions || [],
                        createdAt: profile.created_at,
                        lastLogin: profile.last_login || null,
                        isActive: profile.is_active,
                    };
                    authSession = {
                        user: user,
                        accessToken: session.access_token,
                        refreshToken: session.refresh_token,
                        expiresAt: new Date(session.expires_at * 1000).toISOString(),
                    };
                    set({ user: user, session: authSession });
                    return [4 /*yield*/, get().loadUserPreferences()];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    set({ isInitialized: true, isLoading: false });
                    return [3 /*break*/, 6];
                case 5:
                    error_7 = _b.sent();
                    console.error('Erreur lors de l\'initialisation:', error_7);
                    set({
                        isInitialized: true,
                        isLoading: false,
                        error: error_7.message
                    });
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); },
    updateUser: function (updates) { return __awaiter(void 0, void 0, void 0, function () {
        var user, error, updatedUser, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    user = get().user;
                    if (!user) {
                        throw new Error('Aucun utilisateur connecté');
                    }
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .update(__assign(__assign({}, updates), { updated_at: new Date().toISOString() }))
                            .eq('id', user.id)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        throw error;
                    }
                    updatedUser = __assign(__assign({}, user), updates);
                    set({
                        user: updatedUser,
                        session: get().session ? __assign(__assign({}, get().session), { user: updatedUser }) : null,
                        isLoading: false
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_8 = _a.sent();
                    console.error('Erreur lors de la mise à jour utilisateur:', error_8);
                    set({
                        error: error_8.message || 'Erreur lors de la mise à jour',
                        isLoading: false
                    });
                    throw error_8;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    updatePreferences: function (preferences) { return __awaiter(void 0, void 0, void 0, function () {
        var user, currentPreferences, updatedPreferences, error, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    user = get().user;
                    if (!user) {
                        throw new Error('Aucun utilisateur connecté');
                    }
                    set({ isLoading: true, error: null });
                    currentPreferences = get().preferences || getDefaultPreferences();
                    updatedPreferences = __assign(__assign({}, currentPreferences), preferences);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('user_preferences')
                            .upsert({
                            user_id: user.id,
                            theme: updatedPreferences.theme,
                            language: updatedPreferences.language,
                            currency: updatedPreferences.currency,
                            timezone: updatedPreferences.timezone,
                            notifications: updatedPreferences.notifications,
                            dashboard: updatedPreferences.dashboard,
                            updated_at: new Date().toISOString()
                        })];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        throw error;
                    }
                    set({ preferences: updatedPreferences, isLoading: false });
                    return [3 /*break*/, 3];
                case 2:
                    error_9 = _a.sent();
                    console.error('Erreur lors de la mise à jour des préférences:', error_9);
                    set({
                        error: error_9.message || 'Erreur lors de la mise à jour des préférences',
                        isLoading: false
                    });
                    throw error_9;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    clearError: function () {
        set({ error: null });
    },
    // Méthode pour charger les préférences
    loadUserPreferences: function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, _a, data, error, preferences, error_10;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    user = get().user;
                    if (!user)
                        return [2 /*return*/];
                    return [4 /*yield*/, supabase_1.supabase
                            .from('user_preferences')
                            .select('*')
                            .eq('user_id', user.id)
                            .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                        throw error;
                    }
                    preferences = data ? {
                        theme: data.theme,
                        language: data.language,
                        currency: data.currency,
                        timezone: data.timezone,
                        notifications: data.notifications,
                        dashboard: data.dashboard,
                    } : getDefaultPreferences();
                    set({ preferences: preferences });
                    return [3 /*break*/, 3];
                case 2:
                    error_10 = _b.sent();
                    console.error('Erreur lors du chargement des préférences:', error_10);
                    // En cas d'erreur, utiliser les préférences par défaut
                    set({ preferences: getDefaultPreferences() });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); },
}); }, {
    name: 'zua-pressing-auth',
    partialize: function (state) { return ({
        user: state.user,
        session: state.session,
        preferences: state.preferences,
    }); },
    version: 1,
})));
// Écouter les changements d'authentification Supabase
if (typeof window !== 'undefined') {
    supabase_1.supabase.auth.onAuthStateChange(function (event, session) { return __awaiter(void 0, void 0, void 0, function () {
        var store, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    store = exports.useAuthStore.getState();
                    _a = event;
                    switch (_a) {
                        case 'SIGNED_IN': return [3 /*break*/, 1];
                        case 'SIGNED_OUT': return [3 /*break*/, 4];
                        case 'TOKEN_REFRESHED': return [3 /*break*/, 5];
                    }
                    return [3 /*break*/, 8];
                case 1:
                    if (!((session === null || session === void 0 ? void 0 : session.user) && !store.user)) return [3 /*break*/, 3];
                    return [4 /*yield*/, store.initialize()];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3: return [3 /*break*/, 8];
                case 4:
                    if (store.user) {
                        exports.useAuthStore.setState({
                            user: null,
                            session: null,
                            preferences: null,
                            error: null
                        });
                    }
                    return [3 /*break*/, 8];
                case 5:
                    if (!((session === null || session === void 0 ? void 0 : session.user) && store.user)) return [3 /*break*/, 7];
                    return [4 /*yield*/, store.refreshSession()];
                case 6:
                    _b.sent();
                    _b.label = 7;
                case 7: return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); });
    // Auto-refresh de la session toutes les heures
    setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
        var store, expiresAt, now, timeUntilExpiry;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    store = exports.useAuthStore.getState();
                    if (!(store.session && store.user)) return [3 /*break*/, 2];
                    expiresAt = new Date(store.session.expiresAt);
                    now = new Date();
                    timeUntilExpiry = expiresAt.getTime() - now.getTime();
                    if (!(timeUntilExpiry < 60 * 60 * 1000)) return [3 /*break*/, 2];
                    return [4 /*yield*/, store.refreshSession()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); }, 30 * 60 * 1000); // Vérifier toutes les 30 minutes
}
// Sélecteurs pour optimiser les re-renders
var useAuth = function () {
    return (0, exports.useAuthStore)(function (state) { return ({
        user: state.user,
        session: state.session,
        isLoading: state.isLoading,
        isInitialized: state.isInitialized,
        error: state.error,
    }); });
};
exports.useAuth = useAuth;
var useAuthActions = function () {
    return (0, exports.useAuthStore)(function (state) { return ({
        signIn: state.signIn,
        signUp: state.signUp,
        signOut: state.signOut,
        resetPassword: state.resetPassword,
        updatePassword: state.updatePassword,
        refreshSession: state.refreshSession,
        initialize: state.initialize,
        updateUser: state.updateUser,
        clearError: state.clearError,
    }); });
};
exports.useAuthActions = useAuthActions;
var useUserPreferences = function () {
    return (0, exports.useAuthStore)(function (state) { return ({
        preferences: state.preferences,
        updatePreferences: state.updatePreferences,
    }); });
};
exports.useUserPreferences = useUserPreferences;
// Helper pour vérifier les permissions
var useUserPermissions = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    var user = (0, exports.useAuthStore)(function (state) { return state.user; });
    return {
        canCreateInvoice: (_c = (_b = (_a = user === null || user === void 0 ? void 0 : user.permissions) === null || _a === void 0 ? void 0 : _a.find(function (p) { return p.action === 'create_invoice'; })) === null || _b === void 0 ? void 0 : _b.granted) !== null && _c !== void 0 ? _c : false,
        canCancelInvoice: (_f = (_e = (_d = user === null || user === void 0 ? void 0 : user.permissions) === null || _d === void 0 ? void 0 : _d.find(function (p) { return p.action === 'cancel_invoice'; })) === null || _e === void 0 ? void 0 : _e.granted) !== null && _f !== void 0 ? _f : false,
        canViewRevenue: (_j = (_h = (_g = user === null || user === void 0 ? void 0 : user.permissions) === null || _g === void 0 ? void 0 : _g.find(function (p) { return p.action === 'view_revenue'; })) === null || _h === void 0 ? void 0 : _h.granted) !== null && _j !== void 0 ? _j : false,
        canManageUsers: (_m = (_l = (_k = user === null || user === void 0 ? void 0 : user.permissions) === null || _k === void 0 ? void 0 : _k.find(function (p) { return p.action === 'manage_users'; })) === null || _l === void 0 ? void 0 : _l.granted) !== null && _m !== void 0 ? _m : false,
        canModifyPrices: (_q = (_p = (_o = user === null || user === void 0 ? void 0 : user.permissions) === null || _o === void 0 ? void 0 : _o.find(function (p) { return p.action === 'modify_prices'; })) === null || _p === void 0 ? void 0 : _p.granted) !== null && _q !== void 0 ? _q : false,
        canExportData: (_t = (_s = (_r = user === null || user === void 0 ? void 0 : user.permissions) === null || _r === void 0 ? void 0 : _r.find(function (p) { return p.action === 'export_data'; })) === null || _s === void 0 ? void 0 : _s.granted) !== null && _t !== void 0 ? _t : false,
        isOwner: (user === null || user === void 0 ? void 0 : user.role) === 'owner',
        isEmployee: (user === null || user === void 0 ? void 0 : user.role) === 'employee',
    };
};
exports.useUserPermissions = useUserPermissions;
