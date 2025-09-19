"use strict";
// =============================================================================
// API ROUTE POUR LES ARTICLES - Digit PRESSING
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
exports.PATCH = exports.DELETE = exports.PUT = exports.POST = exports.GET = void 0;
var server_1 = require("next/server");
var supabase_1 = require("@/lib/supabase");
var zod_1 = require("zod");
// Schémas de validation
var createArticleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Le nom de l\'article est requis').max(255),
    category: zod_1.z.enum([
        'vetement', 'accessoire', 'special', 'cuir', 'retouche',
        'chaussure', 'maison', 'traditionnel', 'delicat', 'ceremonie',
        'enfant', 'uniforme'
    ]),
    defaultPrice: zod_1.z.number().min(0, 'Le prix doit être positif'),
    description: zod_1.z.string().optional(),
    estimatedDays: zod_1.z.number().min(1, 'La durée doit être d\'au moins 1 jour').default(3),
    isActive: zod_1.z.boolean().default(true),
});
var updateArticleSchema = createArticleSchema.partial();
var filtersSchema = zod_1.z.object({
    category: zod_1.z.enum([
        'vetement', 'accessoire', 'special', 'cuir', 'retouche',
        'chaussure', 'maison', 'traditionnel', 'delicat', 'ceremonie',
        'enfant', 'uniforme'
    ]).optional(),
    isActive: zod_1.z.coerce.boolean().optional(),
    search: zod_1.z.string().optional(),
    minPrice: zod_1.z.coerce.number().min(0).optional(),
    maxPrice: zod_1.z.coerce.number().min(0).optional(),
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(200).default(50),
    sortBy: zod_1.z.enum(['name', 'category', 'defaultPrice', 'createdAt']).default('name'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc'),
    includeInactive: zod_1.z.coerce.boolean().default(false),
});
var bulkActionSchema = zod_1.z.object({
    action: zod_1.z.enum(['activate', 'deactivate', 'delete', 'update_price']),
    articleIds: zod_1.z.array(zod_1.z.string().uuid()).min(1, 'Au moins un article requis'),
    data: zod_1.z.record(zod_1.z.any()).optional(),
});
// Helper pour vérifier l'authentification
function verifyAuth(request) {
    return __awaiter(this, void 0, Promise, function () {
        var authHeader, token, _a, user, error, _b, profile, profileError;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    authHeader = request.headers.get('authorization');
                    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Token manquant' }, { status: 401 })];
                    }
                    token = authHeader.substring(7);
                    return [4 /*yield*/, supabase_1.supabase.auth.getUser(token)];
                case 1:
                    _a = _c.sent(), user = _a.data.user, error = _a.error;
                    if (error || !user) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Token invalide' }, { status: 401 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users')
                            .select('*')
                            .eq('id', user.id)
                            .single()];
                case 2:
                    _b = _c.sent(), profile = _b.data, profileError = _b.error;
                    if (profileError || !profile || !profile.is_active) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Utilisateur inactif' }, { status: 403 })];
                    }
                    // Vérification que l'utilisateur a un pressing_id
                    if (!profile.pressing_id) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Pressing non configuré' }, { status: 400 })];
                    }
                    return [2 /*return*/, { user: profile }];
            }
        });
    });
}
// Helper pour vérifier les permissions
function hasPermission(user, action) {
    var _a;
    if ((user === null || user === void 0 ? void 0 : user.role) === 'owner')
        return true;
    var permission = (_a = user === null || user === void 0 ? void 0 : user.permissions) === null || _a === void 0 ? void 0 : _a.find(function (p) { return p.action === action; });
    return (permission === null || permission === void 0 ? void 0 : permission.granted) || false;
}
// GET - Récupérer les articles
function GET(request) {
    return __awaiter(this, void 0, void 0, function () {
        var authResult, user, searchParams, filters, query, sortField, from, to, _a, articles, queryError, count, enrichedArticles, totalPages, categoryStats, stats, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    authResult = _b.sent();
                    if (authResult instanceof server_1.NextResponse) {
                        return [2 /*return*/, authResult]; // Retourne la réponse d'erreur de NextResponse
                    }
                    user = authResult.user;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 5, , 6]);
                    searchParams = new URL(request.url).searchParams;
                    filters = filtersSchema.parse(Object.fromEntries(searchParams));
                    query = supabase_1.supabase
                        .from('articles')
                        .select('*', { count: 'exact' })
                        .eq('pressing_id', user.pressing_id);
                    // Filtrer les articles supprimés (soft delete)
                    query = query.eq('is_deleted', false);
                    // Application des filtres
                    if (filters.category) {
                        query = query.eq('category', filters.category);
                    }
                    if (filters.isActive !== undefined) {
                        query = query.eq('is_active', filters.isActive);
                    }
                    else if (!filters.includeInactive) {
                        // Par défaut, ne montrer que les articles actifs
                        query = query.eq('is_active', true);
                    }
                    if (filters.search) {
                        query = query.or("name.ilike.%".concat(filters.search, "%,description.ilike.%").concat(filters.search, "%"));
                    }
                    if (filters.minPrice) {
                        query = query.gte('default_price', filters.minPrice);
                    }
                    if (filters.maxPrice) {
                        query = query.lte('default_price', filters.maxPrice);
                    }
                    sortField = filters.sortBy === 'defaultPrice' ? 'default_price' :
                        filters.sortBy === 'createdAt' ? 'created_at' :
                            filters.sortBy;
                    query = query.order(sortField, { ascending: filters.sortOrder === 'asc' });
                    from = (filters.page - 1) * filters.limit;
                    to = from + filters.limit - 1;
                    query = query.range(from, to);
                    return [4 /*yield*/, query];
                case 3:
                    _a = _b.sent(), articles = _a.data, queryError = _a.error, count = _a.count;
                    if (queryError) {
                        throw queryError;
                    }
                    enrichedArticles = (articles || []).map(function (article) { return (__assign(__assign({}, article), { _metadata: {
                            daysSinceCreated: Math.floor((new Date().getTime() - new Date(article.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                            priceCategory: article.default_price < 2000 ? 'economique' :
                                article.default_price < 10000 ? 'standard' : 'premium',
                        } })); });
                    totalPages = Math.ceil((count || 0) / filters.limit);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .select('category, is_active')
                            .eq('pressing_id', user.pressing_id)
                            .eq('is_deleted', false)];
                case 4:
                    categoryStats = (_b.sent()).data;
                    stats = (categoryStats === null || categoryStats === void 0 ? void 0 : categoryStats.reduce(function (acc, article) {
                        if (!acc[article.category]) {
                            acc[article.category] = { total: 0, active: 0, inactive: 0 };
                        }
                        acc[article.category].total++;
                        if (article.is_active) {
                            acc[article.category].active++;
                        }
                        else {
                            acc[article.category].inactive++;
                        }
                        return acc;
                    }, {})) || {};
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: {
                                articles: enrichedArticles,
                                pagination: {
                                    page: filters.page,
                                    limit: filters.limit,
                                    total: count || 0,
                                    totalPages: totalPages,
                                    hasNext: filters.page < totalPages,
                                    hasPrev: filters.page > 1,
                                },
                                stats: {
                                    total: count || 0,
                                    by_category: stats,
                                    active: (categoryStats === null || categoryStats === void 0 ? void 0 : categoryStats.filter(function (a) { return a.is_active; }).length) || 0,
                                    inactive: (categoryStats === null || categoryStats === void 0 ? void 0 : categoryStats.filter(function (a) { return !a.is_active; }).length) || 0,
                                },
                            },
                        })];
                case 5:
                    error_1 = _b.sent();
                    console.error('Erreur GET /api/articles:', error_1);
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
                case 6: return [2 /*return*/];
            }
        });
    });
}
exports.GET = GET;
// POST - Créer un nouvel article
function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var authResult, user, body, articleData, existingArticle, _a, newArticle, insertError, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    authResult = _b.sent();
                    if (authResult instanceof server_1.NextResponse) {
                        return [2 /*return*/, authResult];
                    }
                    user = authResult.user;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 6, , 7]);
                    // Vérifier les permissions
                    if (!hasPermission(user, 'modify_prices')) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Permission refusée - Modification des prix requise' }, { status: 403 })];
                    }
                    return [4 /*yield*/, request.json()];
                case 3:
                    body = _b.sent();
                    articleData = createArticleSchema.parse(body);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .select('name')
                            .eq('pressing_id', user.pressing_id)
                            .eq('name', articleData.name)
                            .eq('is_deleted', false)
                            .single()];
                case 4:
                    existingArticle = (_b.sent()).data;
                    if (existingArticle) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Un article avec ce nom existe déjà' }, { status: 409 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .insert({
                            pressing_id: user.pressing_id,
                            name: articleData.name,
                            category: articleData.category,
                            default_price: articleData.defaultPrice,
                            description: articleData.description || null,
                            estimated_days: articleData.estimatedDays,
                            is_active: articleData.isActive,
                        })
                            .select()
                            .single()];
                case 5:
                    _a = _b.sent(), newArticle = _a.data, insertError = _a.error;
                    if (insertError) {
                        throw insertError;
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: newArticle,
                            message: 'Article créé avec succès',
                        }, { status: 201 })];
                case 6:
                    error_2 = _b.sent();
                    console.error('Erreur POST /api/articles:', error_2);
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
                case 7: return [2 /*return*/];
            }
        });
    });
}
exports.POST = POST;
// PUT - Mettre à jour un article
function PUT(request) {
    return __awaiter(this, void 0, void 0, function () {
        var authResult, user, body, id, updates, updateData, _a, existingArticle, fetchError, duplicateName, dbUpdateData, _b, updatedArticle, updateError, error_3;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    authResult = _c.sent();
                    if (authResult instanceof server_1.NextResponse) {
                        return [2 /*return*/, authResult];
                    }
                    user = authResult.user;
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 8, , 9]);
                    // Vérifier les permissions
                    if (!hasPermission(user, 'modify_prices')) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Permission refusée - Modification des prix requise' }, { status: 403 })];
                    }
                    return [4 /*yield*/, request.json()];
                case 3:
                    body = _c.sent();
                    id = body.id, updates = __rest(body, ["id"]);
                    if (!id) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'ID de l\'article requis' }, { status: 400 })];
                    }
                    updateData = updateArticleSchema.parse(updates);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .select('*')
                            .eq('id', id)
                            .eq('pressing_id', user.pressing_id)
                            .eq('is_deleted', false)
                            .single()];
                case 4:
                    _a = _c.sent(), existingArticle = _a.data, fetchError = _a.error;
                    if (fetchError || !existingArticle) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Article non trouvé' }, { status: 404 })];
                    }
                    if (!(updateData.name && updateData.name !== existingArticle.name)) return [3 /*break*/, 6];
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .select('id')
                            .eq('pressing_id', user.pressing_id)
                            .eq('name', updateData.name)
                            .eq('is_deleted', false)
                            .neq('id', id)
                            .single()];
                case 5:
                    duplicateName = (_c.sent()).data;
                    if (duplicateName) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Un autre article avec ce nom existe déjà' }, { status: 409 })];
                    }
                    _c.label = 6;
                case 6:
                    dbUpdateData = {
                        updated_at: new Date().toISOString(),
                    };
                    if (updateData.name)
                        dbUpdateData.name = updateData.name;
                    if (updateData.category)
                        dbUpdateData.category = updateData.category;
                    if (updateData.defaultPrice !== undefined)
                        dbUpdateData.default_price = updateData.defaultPrice;
                    if (updateData.description !== undefined)
                        dbUpdateData.description = updateData.description || null;
                    if (updateData.estimatedDays)
                        dbUpdateData.estimated_days = updateData.estimatedDays;
                    if (updateData.isActive !== undefined)
                        dbUpdateData.is_active = updateData.isActive;
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .update(dbUpdateData)
                            .eq('id', id)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 7:
                    _b = _c.sent(), updatedArticle = _b.data, updateError = _b.error;
                    if (updateError) {
                        throw updateError;
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: updatedArticle,
                            message: 'Article mis à jour avec succès',
                        })];
                case 8:
                    error_3 = _c.sent();
                    console.error('Erreur PUT /api/articles:', error_3);
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
                case 9: return [2 /*return*/];
            }
        });
    });
}
exports.PUT = PUT;
// DELETE - Supprimer un article (soft delete)
function DELETE(request) {
    return __awaiter(this, void 0, void 0, function () {
        var authResult, user, searchParams, articleId, _a, existingArticle, fetchError, _b, usageCheck, usageError, _c, deletedArticle, deleteError, error_4;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    authResult = _d.sent();
                    if (authResult instanceof server_1.NextResponse) {
                        return [2 /*return*/, authResult];
                    }
                    user = authResult.user;
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 6, , 7]);
                    // Seuls les propriétaires peuvent supprimer
                    if (user.role !== 'owner') {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Seuls les propriétaires peuvent supprimer des articles' }, { status: 403 })];
                    }
                    searchParams = new URL(request.url).searchParams;
                    articleId = searchParams.get('id');
                    if (!articleId) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'ID de l\'article requis' }, { status: 400 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .select('*')
                            .eq('id', articleId)
                            .eq('pressing_id', user.pressing_id)
                            .eq('is_deleted', false)
                            .single()];
                case 3:
                    _a = _d.sent(), existingArticle = _a.data, fetchError = _a.error;
                    if (fetchError || !existingArticle) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Article non trouvé' }, { status: 404 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .select('id')
                            .eq('pressing_id', user.pressing_id)
                            .eq('status', 'active')
                            .contains('items', [{ id: articleId }])
                            .limit(1)];
                case 4:
                    _b = _d.sent(), usageCheck = _b.data, usageError = _b.error;
                    if (usageError) {
                        console.error('Erreur lors de la vérification d\'usage:', usageError);
                    }
                    if (usageCheck && usageCheck.length > 0) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Impossible de supprimer un article utilisé dans des factures actives' }, { status: 400 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .update({
                            is_deleted: true,
                            is_active: false,
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', articleId)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 5:
                    _c = _d.sent(), deletedArticle = _c.data, deleteError = _c.error;
                    if (deleteError) {
                        throw deleteError;
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: deletedArticle,
                            message: 'Article supprimé avec succès',
                        })];
                case 6:
                    error_4 = _d.sent();
                    console.error('Erreur DELETE /api/articles:', error_4);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_4.message || 'Erreur interne du serveur'
                        }, { status: 500 })];
                case 7: return [2 /*return*/];
            }
        });
    });
}
exports.DELETE = DELETE;
// PATCH - Actions en lot sur les articles
function PATCH(request) {
    return __awaiter(this, void 0, void 0, function () {
        var authResult, user, body, _a, action, articleIds, data, _b, articles, fetchError, updateData, message, _c, priceUpdates, _loop_1, _i, articleIds_1, articleId, bulkUpdateError, error_5;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    authResult = _d.sent();
                    if (authResult instanceof server_1.NextResponse) {
                        return [2 /*return*/, authResult];
                    }
                    user = authResult.user;
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 14, , 15]);
                    // Vérifier les permissions
                    if (!hasPermission(user, 'modify_prices')) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Permission refusée - Modification des prix requise' }, { status: 403 })];
                    }
                    return [4 /*yield*/, request.json()];
                case 3:
                    body = _d.sent();
                    _a = bulkActionSchema.parse(body), action = _a.action, articleIds = _a.articleIds, data = _a.data;
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .select('id, name, default_price, is_active')
                            .eq('pressing_id', user.pressing_id)
                            .eq('is_deleted', false)
                            .in('id', articleIds)];
                case 4:
                    _b = _d.sent(), articles = _b.data, fetchError = _b.error;
                    if (fetchError) {
                        throw fetchError;
                    }
                    if (!articles || articles.length !== articleIds.length) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Certains articles n\'ont pas été trouvés' }, { status: 404 })];
                    }
                    updateData = { updated_at: new Date().toISOString() };
                    message = '';
                    _c = action;
                    switch (_c) {
                        case 'activate': return [3 /*break*/, 5];
                        case 'deactivate': return [3 /*break*/, 6];
                        case 'delete': return [3 /*break*/, 7];
                        case 'update_price': return [3 /*break*/, 8];
                    }
                    return [3 /*break*/, 10];
                case 5:
                    updateData.is_active = true;
                    message = "".concat(articleIds.length, " article(s) activ\u00E9(s)");
                    return [3 /*break*/, 11];
                case 6:
                    updateData.is_active = false;
                    message = "".concat(articleIds.length, " article(s) d\u00E9sactiv\u00E9(s)");
                    return [3 /*break*/, 11];
                case 7:
                    if (user.role !== 'owner') {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Seuls les propriétaires peuvent supprimer des articles' }, { status: 403 })];
                    }
                    updateData.is_deleted = true;
                    updateData.is_active = false;
                    message = "".concat(articleIds.length, " article(s) supprim\u00E9(s)");
                    return [3 /*break*/, 11];
                case 8:
                    if (!(data === null || data === void 0 ? void 0 : data.priceMultiplier) && !(data === null || data === void 0 ? void 0 : data.priceIncrease) && !(data === null || data === void 0 ? void 0 : data.newPrice)) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Données de prix manquantes' }, { status: 400 })];
                    }
                    priceUpdates = [];
                    _loop_1 = function (articleId) {
                        var newPrice = void 0;
                        var article = articles.find(function (a) { return a.id === articleId; });
                        if (article) {
                            var currentPrice = article.default_price;
                            if (data.newPrice) {
                                newPrice = data.newPrice;
                            }
                            else if (data.priceMultiplier) {
                                newPrice = Math.round(currentPrice * data.priceMultiplier);
                            }
                            else if (data.priceIncrease) {
                                newPrice = currentPrice + data.priceIncrease;
                            }
                        }
                        if (newPrice && newPrice > 0) {
                            priceUpdates.push(supabase_1.supabase
                                .from('articles')
                                .update({
                                default_price: newPrice,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', articleId)
                                .eq('pressing_id', user.pressing_id));
                        }
                    };
                    for (_i = 0, articleIds_1 = articleIds; _i < articleIds_1.length; _i++) {
                        articleId = articleIds_1[_i];
                        _loop_1(articleId);
                    }
                    return [4 /*yield*/, Promise.all(priceUpdates)];
                case 9:
                    _d.sent();
                    message = "Prix de ".concat(articleIds.length, " article(s) mis \u00E0 jour");
                    return [3 /*break*/, 11];
                case 10: return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Action non reconnue' }, { status: 400 })];
                case 11:
                    if (!(action !== 'update_price')) return [3 /*break*/, 13];
                    return [4 /*yield*/, supabase_1.supabase
                            .from('articles')
                            .update(updateData)
                            .eq('pressing_id', user.pressing_id)
                            .in('id', articleIds)];
                case 12:
                    bulkUpdateError = (_d.sent()).error;
                    if (bulkUpdateError) {
                        throw bulkUpdateError;
                    }
                    _d.label = 13;
                case 13: return [2 /*return*/, server_1.NextResponse.json({
                        success: true,
                        message: message,
                        data: {
                            affected_count: articleIds.length,
                            article_ids: articleIds,
                        },
                    })];
                case 14:
                    error_5 = _d.sent();
                    console.error('Erreur PATCH /api/articles:', error_5);
                    if (error_5 instanceof zod_1.z.ZodError) {
                        return [2 /*return*/, server_1.NextResponse.json({
                                success: false,
                                error: 'Données invalides',
                                details: error_5.errors
                            }, { status: 400 })];
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_5.message || 'Erreur interne du serveur'
                        }, { status: 500 })];
                case 15: return [2 /*return*/];
            }
        });
    });
}
exports.PATCH = PATCH;
