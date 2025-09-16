"use strict";
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.PUT = exports.POST = exports.GET = void 0;
var server_1 = require("next/server");
var supabase_1 = require("@/lib/supabase");
var zod_1 = require("zod");
// Schémas de validation
var createUserSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    email: zod_1.z.string().email('Format d\'email invalide'),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.enum(['owner', 'employee']),
    permissions: zod_1.z.array(zod_1.z.object({
        action: zod_1.z.string(),
        granted: zod_1.z.boolean(),
    })),
    isActive: zod_1.z.boolean().default(true),
    temporaryPassword: zod_1.z.string().min(6, 'Mot de passe temporaire requis'),
});
var updateUserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    fullName: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.enum(['owner', 'employee']).optional(),
    permissions: zod_1.z.array(zod_1.z.object({
        action: zod_1.z.string(),
        granted: zod_1.z.boolean(),
    })).optional(),
    isActive: zod_1.z.boolean().optional(),
});
var filtersSchema = zod_1.z.object({
    role: zod_1.z.enum(['owner', 'employee']).optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
    search: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    sortBy: zod_1.z.enum(['fullName', 'email', 'role', 'createdAt', 'lastLogin']).default('fullName'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
// Helper pour vérifier l'authentification
function verifyAuth(request) {
    return __awaiter(this, void 0, void 0, function () {
        var authHeader, token, _a, user, error, _b, profile, profileError;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    authHeader = request.headers.get('authorization');
                    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
                        return [2 /*return*/, { error: 'Token manquant', status: 401 }];
                    }
                    token = authHeader.substring(7);
                    return [4 /*yield*/, supabase_1.supabase.auth.getUser(token)];
                case 1:
                    _a = _c.sent(), user = _a.data.user, error = _a.error;
                    if (error || !user) {
                        return [2 /*return*/, { error: 'Token invalide', status: 401 }];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .select('*')
                            .eq('id', user.id)
                            .single()];
                case 2:
                    _b = _c.sent(), profile = _b.data, profileError = _b.error;
                    if (profileError || !profile || !profile.is_active) {
                        return [2 /*return*/, { error: 'Utilisateur inactif', status: 403 }];
                    }
                    return [2 /*return*/, { user: profile }];
            }
        });
    });
}
// Helper pour vérifier les permissions
function hasPermission(user, action) {
    var _a;
    if (user.role === 'owner')
        return true;
    var permission = (_a = user.permissions) === null || _a === void 0 ? void 0 : _a.find(function (p) { return p.action === action; });
    return (permission === null || permission === void 0 ? void 0 : permission.granted) || false;
}
// GET - Récupérer les utilisateurs
function GET(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, searchParams, filters, query, sortField, from, to, _b, users, queryError, count, enrichedUsers, totalPages, statsData, stats, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _a = _c.sent(), user = _a.user, error = _a.error, status = _a.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    // Vérifier les permissions
                    if (!hasPermission(user, 'manage_users')) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Permission refusée - Gestion des utilisateurs requise' }, { status: 403 })];
                    }
                    searchParams = new URL(request.url).searchParams;
                    filters = filtersSchema.parse(Object.fromEntries(searchParams));
                    query = supabase_1.supabase
                        .from('users')
                        .select('*', { count: 'exact' })
                        .eq('pressing_id', user.pressing_id);
                    // Application des filtres
                    if (filters.role) {
                        query = query.eq('role', filters.role);
                    }
                    if (filters.isActive !== undefined) {
                        query = query.eq('is_active', filters.isActive);
                    }
                    if (filters.search) {
                        query = query.or("full_name.ilike.%".concat(filters.search, "%,email.ilike.%").concat(filters.search, "%"));
                    }
                    sortField = filters.sortBy === 'fullName' ? 'full_name' :
                        filters.sortBy === 'createdAt' ? 'created_at' :
                            filters.sortBy === 'lastLogin' ? 'last_login' :
                                filters.sortBy;
                    query = query.order(sortField, { ascending: filters.sortOrder === 'asc' });
                    from = (filters.page - 1) * filters.limit;
                    to = from + filters.limit - 1;
                    query = query.range(from, to);
                    return [4 /*yield*/, query];
                case 2:
                    _b = _c.sent(), users = _b.data, queryError = _b.error, count = _b.count;
                    if (queryError) {
                        throw queryError;
                    }
                    enrichedUsers = (users || []).map(function (u) { return (__assign(__assign({}, u), { _metadata: {
                            daysSinceCreated: Math.floor((new Date().getTime() - new Date(u.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                            daysSinceLastLogin: u.last_login ? Math.floor((new Date().getTime() - new Date(u.last_login).getTime()) / (1000 * 60 * 60 * 24)) : null,
                            permissionCount: u.permissions ? u.permissions.filter(function (p) { return p.granted; }).length : 0,
                        } })); });
                    totalPages = Math.ceil((count || 0) / filters.limit);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .select('role, is_active')
                            .eq('pressing_id', user.pressing_id)];
                case 3:
                    statsData = (_c.sent()).data;
                    stats = {
                        total: count || 0,
                        active: (statsData === null || statsData === void 0 ? void 0 : statsData.filter(function (u) { return u.is_active; }).length) || 0,
                        inactive: (statsData === null || statsData === void 0 ? void 0 : statsData.filter(function (u) { return !u.is_active; }).length) || 0,
                        owners: (statsData === null || statsData === void 0 ? void 0 : statsData.filter(function (u) { return u.role === 'owner'; }).length) || 0,
                        employees: (statsData === null || statsData === void 0 ? void 0 : statsData.filter(function (u) { return u.role === 'employee'; }).length) || 0,
                    };
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: {
                                users: enrichedUsers,
                                pagination: {
                                    page: filters.page,
                                    limit: filters.limit,
                                    total: count || 0,
                                    totalPages: totalPages,
                                    hasNext: filters.page < totalPages,
                                    hasPrev: filters.page > 1,
                                },
                                stats: stats,
                            },
                        })];
                case 4:
                    error_1 = _c.sent();
                    console.error('Erreur GET /api/users:', error_1);
                    if (error_1 instanceof zod_1.z.ZodError) {
                        return [2 /*return*/, server_1.NextResponse.json({
                                success: false,
                                error: 'Paramètres invalides',
                                details: error_1.errors
                            }, { status: 400 })];
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_1.message || 'Erreur interne du serveur'
                        }, { status: 500 })];
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.GET = GET;
// POST - Créer un nouvel utilisateur
function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, body, userData, existingUser, _b, authUser, authError, _c, newUser, profileError, profileError_1, error_2;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 13, , 14]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _a = _d.sent(), user = _a.user, error = _a.error, status = _a.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    // Vérifier les permissions
                    if (!hasPermission(user, 'manage_users')) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Permission refusée - Gestion des utilisateurs requise' }, { status: 403 })];
                    }
                    return [4 /*yield*/, request.json()];
                case 2:
                    body = _d.sent();
                    userData = createUserSchema.parse(body);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .select('email')
                            .eq('email', userData.email)
                            .single()];
                case 3:
                    existingUser = (_d.sent()).data;
                    if (existingUser) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Un utilisateur avec cet email existe déjà' }, { status: 409 })];
                    }
                    if (!supabase_1.supabaseAdmin) {
                        throw new Error('Configuration admin Supabase manquante');
                    }
                    return [4 /*yield*/, supabase_1.supabaseAdmin.auth.admin.createUser({
                            email: userData.email,
                            password: userData.temporaryPassword,
                            email_confirm: true,
                            user_metadata: {
                                full_name: userData.fullName,
                                pressing_id: user.pressing_id,
                            }
                        })];
                case 4:
                    _b = _d.sent(), authUser = _b.data, authError = _b.error;
                    if (authError) {
                        throw new Error("Erreur auth: ".concat(authError.message));
                    }
                    if (!authUser.user) {
                        throw new Error('Utilisateur auth non créé');
                    }
                    _d.label = 5;
                case 5:
                    _d.trys.push([5, 10, , 12]);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .insert({
                            id: authUser.user.id,
                            pressing_id: user.pressing_id,
                            email: userData.email,
                            full_name: userData.fullName,
                            phone: userData.phone,
                            role: userData.role,
                            permissions: userData.permissions,
                            is_active: userData.isActive,
                        })
                            .select()
                            .single()];
                case 6:
                    _c = _d.sent(), newUser = _c.data, profileError = _c.error;
                    if (!profileError) return [3 /*break*/, 8];
                    // Si erreur, nettoyer l'utilisateur auth
                    return [4 /*yield*/, supabase_1.supabaseAdmin.auth.admin.deleteUser(authUser.user.id)];
                case 7:
                    // Si erreur, nettoyer l'utilisateur auth
                    _d.sent();
                    throw profileError;
                case 8: 
                // Envoyer un email de réinitialisation du mot de passe
                return [4 /*yield*/, supabase_1.supabaseAdmin.auth.admin.generateLink({
                        type: 'recovery',
                        email: userData.email,
                        options: {
                            redirectTo: "".concat(process.env.NEXT_PUBLIC_APP_URL, "/auth/reset-password"),
                        }
                    })];
                case 9:
                    // Envoyer un email de réinitialisation du mot de passe
                    _d.sent();
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: newUser,
                            message: 'Utilisateur créé avec succès. Un email de définition du mot de passe a été envoyé.',
                        }, { status: 201 })];
                case 10:
                    profileError_1 = _d.sent();
                    // Nettoyer l'utilisateur auth en cas d'erreur du profil
                    return [4 /*yield*/, supabase_1.supabaseAdmin.auth.admin.deleteUser(authUser.user.id)];
                case 11:
                    // Nettoyer l'utilisateur auth en cas d'erreur du profil
                    _d.sent();
                    throw profileError_1;
                case 12: return [3 /*break*/, 14];
                case 13:
                    error_2 = _d.sent();
                    console.error('Erreur POST /api/users:', error_2);
                    if (error_2 instanceof zod_1.z.ZodError) {
                        return [2 /*return*/, server_1.NextResponse.json({
                                success: false,
                                error: 'Données invalides',
                                details: error_2.errors
                            }, { status: 400 })];
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_2.message || 'Erreur interne du serveur'
                        }, { status: 500 })];
                case 14: return [2 /*return*/];
            }
        });
    });
}
exports.POST = POST;
// PUT - Mettre à jour un utilisateur
function PUT(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, body, _b, id, updates, _c, targetUser, fetchError, updateData, _d, updatedUser, updateError, signOutError_1, error_3;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 9, , 10]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _a = _e.sent(), user = _a.user, error = _a.error, status = _a.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    // Vérifier les permissions
                    if (!hasPermission(user, 'manage_users')) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Permission refusée - Gestion des utilisateurs requise' }, { status: 403 })];
                    }
                    return [4 /*yield*/, request.json()];
                case 2:
                    body = _e.sent();
                    _b = updateUserSchema.parse(body), id = _b.id, updates = __rest(_b, ["id"]);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .select('*')
                            .eq('id', id)
                            .eq('pressing_id', user.pressing_id)
                            .single()];
                case 3:
                    _c = _e.sent(), targetUser = _c.data, fetchError = _c.error;
                    if (fetchError || !targetUser) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Utilisateur non trouvé' }, { status: 404 })];
                    }
                    // Empêcher un utilisateur de se désactiver lui-même
                    if (id === user.id && updates.isActive === false) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Vous ne pouvez pas désactiver votre propre compte' }, { status: 400 })];
                    }
                    updateData = {
                        updated_at: new Date().toISOString(),
                    };
                    if (updates.fullName)
                        updateData.full_name = updates.fullName;
                    if (updates.phone !== undefined)
                        updateData.phone = updates.phone;
                    if (updates.role)
                        updateData.role = updates.role;
                    if (updates.permissions)
                        updateData.permissions = updates.permissions;
                    if (updates.isActive !== undefined)
                        updateData.is_active = updates.isActive;
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .update(updateData)
                            .eq('id', id)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 4:
                    _d = _e.sent(), updatedUser = _d.data, updateError = _d.error;
                    if (updateError) {
                        throw updateError;
                    }
                    if (!(updates.isActive === false && supabase_1.supabaseAdmin)) return [3 /*break*/, 8];
                    _e.label = 5;
                case 5:
                    _e.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, supabase_1.supabaseAdmin.auth.admin.signOut(id, 'global')];
                case 6:
                    _e.sent();
                    return [3 /*break*/, 8];
                case 7:
                    signOutError_1 = _e.sent();
                    console.error('Erreur lors de la déconnexion forcée:', signOutError_1);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/, server_1.NextResponse.json({
                        success: true,
                        data: updatedUser,
                        message: 'Utilisateur mis à jour avec succès',
                    })];
                case 9:
                    error_3 = _e.sent();
                    console.error('Erreur PUT /api/users:', error_3);
                    if (error_3 instanceof zod_1.z.ZodError) {
                        return [2 /*return*/, server_1.NextResponse.json({
                                success: false,
                                error: 'Données invalides',
                                details: error_3.errors
                            }, { status: 400 })];
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_3.message || 'Erreur interne du serveur'
                        }, { status: 500 })];
                case 10: return [2 /*return*/];
            }
        });
    });
}
exports.PUT = PUT;
// DELETE - Supprimer un utilisateur
function DELETE(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, searchParams, targetId, _b, targetUser, fetchError, error_4;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _a = _c.sent(), user = _a.user, error = _a.error, status = _a.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    // Seuls les propriétaires peuvent supprimer
                    if (user.role !== 'owner') {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Seuls les propriétaires peuvent supprimer des utilisateurs' }, { status: 403 })];
                    }
                    searchParams = new URL(request.url).searchParams;
                    targetId = searchParams.get('id');
                    if (!targetId) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'ID utilisateur requis' }, { status: 400 })];
                    }
                    // Empêcher un propriétaire de se supprimer lui-même
                    if (targetId === user.id) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .select('*')
                            .eq('id', targetId)
                            .eq('pressing_id', user.pressing_id)
                            .single()];
                case 2:
                    _b = _c.sent(), targetUser = _b.data, fetchError = _b.error;
                    if (fetchError || !targetUser) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Utilisateur non trouvé' }, { status: 404 })];
                    }
                    if (!supabase_1.supabaseAdmin) {
                        throw new Error('Configuration admin Supabase manquante');
                    }
                    // Supprimer l'utilisateur des deux tables (cascading delete)
                    return [4 /*yield*/, supabase_1.supabaseAdmin.auth.admin.deleteUser(targetId)];
                case 3:
                    // Supprimer l'utilisateur des deux tables (cascading delete)
                    _c.sent();
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            message: 'Utilisateur supprimé avec succès',
                            data: { id: targetId },
                        })];
                case 4:
                    error_4 = _c.sent();
                    console.error('Erreur DELETE /api/users:', error_4);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_4.message || 'Erreur interne du serveur'
                        }, { status: 500 })];
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.DELETE = DELETE;
