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
exports.GET = exports.POST = void 0;
var server_1 = require("next/server");
var supabase_1 = require("@/lib/supabase");
var zod_1 = require("zod");
// Schéma de validation pour la recherche
var searchSchema = zod_1.z.object({
    q: zod_1.z.string().min(1, 'Terme de recherche requis'),
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    offset: zod_1.z.coerce.number().min(0).default(0),
    filters: zod_1.z.object({
        status: zod_1.z.enum(['active', 'cancelled']).optional(),
        paid: zod_1.z.coerce.boolean().optional(),
        withdrawn: zod_1.z.coerce.boolean().optional(),
        urgency: zod_1.z.enum(['normal', 'express', 'urgent']).optional(),
        dateFrom: zod_1.z.string().optional(),
        dateTo: zod_1.z.string().optional(),
        minAmount: zod_1.z.coerce.number().min(0).optional(),
        maxAmount: zod_1.z.coerce.number().min(0).optional(),
        createdBy: zod_1.z.string().optional(),
    }).optional().default({}),
    sortBy: zod_1.z.enum(['relevance', 'date', 'amount', 'client']).default('relevance'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
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
// Helper pour construire la requête de recherche
function buildSearchQuery(searchTerm, filters, pressingId) {
    var query = supabase_1.supabase
        .from('invoices')
        .select('*', { count: 'exact' })
        .eq('pressing_id', pressingId);
    // Recherche textuelle sur plusieurs champs
    var searchConditions = [
        "number.ilike.%".concat(searchTerm, "%"),
        "client_name.ilike.%".concat(searchTerm, "%"),
        "client_phone.ilike.%".concat(searchTerm, "%"),
        "client_email.ilike.%".concat(searchTerm, "%"),
        "notes.ilike.%".concat(searchTerm, "%"),
    ];
    // Recherche dans les tags si le terme contient #
    if (searchTerm.includes('#')) {
        var tag = searchTerm.replace('#', '').trim();
        searchConditions.push("tags.cs.{".concat(tag, "}"));
    }
    // Recherche par montant exact si le terme est numérique
    var numericSearch = parseFloat(searchTerm);
    if (!isNaN(numericSearch)) {
        searchConditions.push("total.eq.".concat(numericSearch));
        searchConditions.push("subtotal.eq.".concat(numericSearch));
    }
    query = query.or(searchConditions.join(','));
    // Application des filtres
    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    if (filters.paid !== undefined) {
        query = query.eq('paid', filters.paid);
    }
    if (filters.withdrawn !== undefined) {
        query = query.eq('withdrawn', filters.withdrawn);
    }
    if (filters.urgency) {
        query = query.eq('urgency', filters.urgency);
    }
    if (filters.dateFrom) {
        query = query.gte('deposit_date', filters.dateFrom);
    }
    if (filters.dateTo) {
        query = query.lte('deposit_date', filters.dateTo);
    }
    if (filters.minAmount) {
        query = query.gte('total', filters.minAmount);
    }
    if (filters.maxAmount) {
        query = query.lte('total', filters.maxAmount);
    }
    if (filters.createdBy) {
        query = query.eq('created_by', filters.createdBy);
    }
    return query;
}
// Helper pour calculer le score de pertinence
function calculateRelevanceScore(invoice, searchTerm) {
    var _a, _b, _c, _d;
    var lowerSearchTerm = searchTerm.toLowerCase();
    var score = 0;
    // Score basé sur la correspondance exacte dans différents champs
    if (invoice.number.toLowerCase().includes(lowerSearchTerm)) {
        score += invoice.number.toLowerCase() === lowerSearchTerm ? 100 : 50;
    }
    if (invoice.client_name.toLowerCase().includes(lowerSearchTerm)) {
        score += invoice.client_name.toLowerCase() === lowerSearchTerm ? 80 : 30;
    }
    if ((_a = invoice.client_phone) === null || _a === void 0 ? void 0 : _a.includes(lowerSearchTerm)) {
        score += invoice.client_phone === lowerSearchTerm ? 90 : 40;
    }
    if ((_b = invoice.client_email) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(lowerSearchTerm)) {
        score += invoice.client_email.toLowerCase() === lowerSearchTerm ? 70 : 25;
    }
    if ((_c = invoice.notes) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(lowerSearchTerm)) {
        score += 20;
    }
    if ((_d = invoice.tags) === null || _d === void 0 ? void 0 : _d.some(function (tag) { return tag.toLowerCase().includes(lowerSearchTerm); })) {
        score += 35;
    }
    // Bonus pour les correspondances récentes
    var daysSinceCreated = Math.floor((new Date().getTime() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCreated <= 7)
        score += 10;
    else if (daysSinceCreated <= 30)
        score += 5;
    // Bonus pour les factures actives
    if (invoice.status === 'active')
        score += 10;
    // Bonus pour les factures non payées ou non retirées (plus pertinentes)
    if (!invoice.paid)
        score += 15;
    if (invoice.paid && !invoice.withdrawn)
        score += 10;
    return score;
}
// POST - Recherche avancée de factures
function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, body, searchParams, searchTerm_1, limit, offset, filters, sortBy, sortOrder_1, query, _b, invoices, queryError, count, results, enrichedResults, searchStats, error_1;
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
                    return [4 /*yield*/, request.json()];
                case 2:
                    body = _c.sent();
                    searchParams = searchSchema.parse(body);
                    searchTerm_1 = searchParams.q, limit = searchParams.limit, offset = searchParams.offset, filters = searchParams.filters, sortBy = searchParams.sortBy, sortOrder_1 = searchParams.sortOrder;
                    query = buildSearchQuery(searchTerm_1, filters, user.pressing_id);
                    // Application du tri selon le critère choisi
                    switch (sortBy) {
                        case 'date':
                            query = query.order('created_at', { ascending: sortOrder_1 === 'asc' });
                            break;
                        case 'amount':
                            query = query.order('total', { ascending: sortOrder_1 === 'asc' });
                            break;
                        case 'client':
                            query = query.order('client_name', { ascending: sortOrder_1 === 'asc' });
                            break;
                        case 'relevance':
                        default:
                            // Pour la pertinence, on récupère tout et on trie en mémoire
                            break;
                    }
                    // Application de la pagination (sauf pour la pertinence)
                    if (sortBy !== 'relevance') {
                        query = query.range(offset, offset + limit - 1);
                    }
                    return [4 /*yield*/, query];
                case 3:
                    _b = _c.sent(), invoices = _b.data, queryError = _b.error, count = _b.count;
                    if (queryError) {
                        throw queryError;
                    }
                    results = invoices || [];
                    // Tri par pertinence si demandé
                    if (sortBy === 'relevance') {
                        results = results
                            .map(function (invoice) { return (__assign(__assign({}, invoice), { _relevanceScore: calculateRelevanceScore(invoice, searchTerm_1) })); })
                            .sort(function (a, b) {
                            if (sortOrder_1 === 'asc') {
                                return a._relevanceScore - b._relevanceScore;
                            }
                            return b._relevanceScore - a._relevanceScore;
                        })
                            .slice(offset, offset + limit)
                            .map(function (_a) {
                            var _relevanceScore = _a._relevanceScore, invoice = __rest(_a, ["_relevanceScore"]);
                            return invoice;
                        });
                    }
                    enrichedResults = results.map(function (invoice) { return (__assign(__assign({}, invoice), { _metadata: {
                            daysSinceCreated: Math.floor((new Date().getTime() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                            isOverdue: invoice.estimated_ready_date
                                ? new Date(invoice.estimated_ready_date) < new Date() && !invoice.withdrawn
                                : false,
                            status_display: invoice.status === 'active' ?
                                (invoice.withdrawn ? 'Retiré' :
                                    invoice.paid ? 'Prêt' : 'En attente') : 'Annulé',
                            search_highlights: getSearchHighlights(invoice, searchTerm_1),
                        } })); });
                    searchStats = {
                        total_results: count || 0,
                        showing: results.length,
                        page: Math.floor(offset / limit) + 1,
                        total_pages: Math.ceil((count || 0) / limit),
                        search_term: searchTerm_1,
                        filters_applied: Object.keys(filters).length,
                    };
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: {
                                results: enrichedResults,
                                stats: searchStats,
                            },
                        })];
                case 4:
                    error_1 = _c.sent();
                    console.error('Erreur POST /api/invoices/search:', error_1);
                    if (error_1 instanceof zod_1.z.ZodError) {
                        return [2 /*return*/, server_1.NextResponse.json({
                                success: false,
                                error: 'Paramètres de recherche invalides',
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
exports.POST = POST;
// GET - Recherche simple (pour compatibilité)
function GET(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, searchParams, q, searchBody, searchParams_validated_1, query, sortField, _b, invoices, queryError, count, results, error_2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _a = _c.sent(), user = _a.user, error = _a.error, status = _a.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    searchParams = new URL(request.url).searchParams;
                    q = searchParams.get('q');
                    if (!q) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Paramètre de recherche "q" requis' }, { status: 400 })];
                    }
                    searchBody = {
                        q: q,
                        limit: parseInt(searchParams.get('limit') || '20'),
                        offset: parseInt(searchParams.get('offset') || '0'),
                        sortBy: searchParams.get('sortBy') || 'relevance',
                        sortOrder: searchParams.get('sortOrder') || 'desc',
                    };
                    searchParams_validated_1 = searchSchema.parse(searchBody);
                    query = buildSearchQuery(searchParams_validated_1.q, {}, user.pressing_id);
                    if (searchParams_validated_1.sortBy !== 'relevance') {
                        sortField = searchParams_validated_1.sortBy === 'date' ? 'created_at' :
                            searchParams_validated_1.sortBy === 'amount' ? 'total' :
                                searchParams_validated_1.sortBy === 'client' ? 'client_name' : 'created_at';
                        query = query.order(sortField, { ascending: searchParams_validated_1.sortOrder === 'asc' });
                    }
                    query = query.range(searchParams_validated_1.offset, searchParams_validated_1.offset + searchParams_validated_1.limit - 1);
                    return [4 /*yield*/, query];
                case 2:
                    _b = _c.sent(), invoices = _b.data, queryError = _b.error, count = _b.count;
                    if (queryError) {
                        throw queryError;
                    }
                    results = invoices || [];
                    // Tri par pertinence si demandé
                    if (searchParams_validated_1.sortBy === 'relevance') {
                        results = results
                            .map(function (invoice) { return (__assign(__assign({}, invoice), { _relevanceScore: calculateRelevanceScore(invoice, searchParams_validated_1.q) })); })
                            .sort(function (a, b) { return b._relevanceScore - a._relevanceScore; })
                            .map(function (_a) {
                            var _relevanceScore = _a._relevanceScore, invoice = __rest(_a, ["_relevanceScore"]);
                            return invoice;
                        });
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: {
                                results: results,
                                stats: {
                                    total_results: count || 0,
                                    showing: results.length,
                                    search_term: q,
                                },
                            },
                        })];
                case 3:
                    error_2 = _c.sent();
                    console.error('Erreur GET /api/invoices/search:', error_2);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_2.message || 'Erreur interne du serveur'
                        }, { status: 500 })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.GET = GET;
// Helper pour mettre en évidence les termes de recherche
function getSearchHighlights(invoice, searchTerm) {
    var _a, _b, _c;
    var lowerSearchTerm = searchTerm.toLowerCase();
    var highlights = {};
    // Vérifier chaque champ pour les correspondances
    if (invoice.number.toLowerCase().includes(lowerSearchTerm)) {
        highlights.number = true;
    }
    if (invoice.client_name.toLowerCase().includes(lowerSearchTerm)) {
        highlights.client_name = true;
    }
    if ((_a = invoice.client_phone) === null || _a === void 0 ? void 0 : _a.includes(lowerSearchTerm)) {
        highlights.client_phone = true;
    }
    if ((_b = invoice.client_email) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(lowerSearchTerm)) {
        highlights.client_email = true;
    }
    if ((_c = invoice.notes) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(lowerSearchTerm)) {
        highlights.notes = true;
    }
    var numericSearch = parseFloat(searchTerm);
    if (!isNaN(numericSearch) && (invoice.total === numericSearch || invoice.subtotal === numericSearch)) {
        highlights.amount = true;
    }
    return highlights;
}
