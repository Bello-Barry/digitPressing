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
// Schéma de validation pour création de facture
var createInvoiceSchema = zod_1.z.object({
    clientName: zod_1.z.string().min(1, 'Le nom du client est requis'),
    clientPhone: zod_1.z.string().optional(),
    clientEmail: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    clientAddress: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        quantity: zod_1.z.number().min(1),
        unitPrice: zod_1.z.number().min(0),
        total: zod_1.z.number().min(0),
        category: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    })).min(1, 'Au moins un article est requis'),
    subtotal: zod_1.z.number().min(0),
    discount: zod_1.z.number().min(0).optional(),
    discountType: zod_1.z.enum(['amount', 'percentage']).optional(),
    tax: zod_1.z.number().min(0).optional(),
    total: zod_1.z.number().min(0),
    depositDate: zod_1.z.string(),
    estimatedReadyDate: zod_1.z.string().optional(),
    urgency: zod_1.z.enum(['normal', 'express', 'urgent']).default('normal'),
    notes: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
var updateInvoiceSchema = createInvoiceSchema.partial();
// Schéma pour les filtres de recherche
var searchFiltersSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(100).default(50),
    status: zod_1.z.enum(['active', 'cancelled']).optional(),
    paid: zod_1.z.coerce.boolean().optional(),
    withdrawn: zod_1.z.coerce.boolean().optional(),
    urgency: zod_1.z.enum(['normal', 'express', 'urgent']).optional(),
    dateFrom: zod_1.z.string().optional(),
    dateTo: zod_1.z.string().optional(),
    clientName: zod_1.z.string().optional(),
    createdBy: zod_1.z.string().optional(),
    minAmount: zod_1.z.coerce.number().min(0).optional(),
    maxAmount: zod_1.z.coerce.number().min(0).optional(),
    sortBy: zod_1.z.enum(['createdAt', 'total', 'clientName', 'depositDate']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
    search: zod_1.z.string().optional(),
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
// GET - Récupérer les factures avec filtres
function GET(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, searchParams, filters, query, sortField, from, to, _b, invoices, queryError, count, totalPages, error_1;
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
                    filters = searchFiltersSchema.parse(Object.fromEntries(searchParams));
                    query = supabase_1.supabase
                        .from('invoices')
                        .select('*', { count: 'exact' })
                        .eq('pressing_id', user.pressing_id);
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
                    if (filters.clientName) {
                        query = query.ilike('client_name', "%".concat(filters.clientName, "%"));
                    }
                    if (filters.createdBy) {
                        query = query.eq('created_by', filters.createdBy);
                    }
                    if (filters.minAmount) {
                        query = query.gte('total', filters.minAmount);
                    }
                    if (filters.maxAmount) {
                        query = query.lte('total', filters.maxAmount);
                    }
                    if (filters.search) {
                        query = query.or("number.ilike.%".concat(filters.search, "%,client_name.ilike.%").concat(filters.search, "%,client_phone.ilike.%").concat(filters.search, "%"));
                    }
                    sortField = filters.sortBy === 'createdAt' ? 'created_at' :
                        filters.sortBy === 'clientName' ? 'client_name' :
                            filters.sortBy === 'depositDate' ? 'deposit_date' :
                                filters.sortBy;
                    query = query.order(sortField, { ascending: filters.sortOrder === 'asc' });
                    from = (filters.page - 1) * filters.limit;
                    to = from + filters.limit - 1;
                    query = query.range(from, to);
                    return [4 /*yield*/, query];
                case 2:
                    _b = _c.sent(), invoices = _b.data, queryError = _b.error, count = _b.count;
                    if (queryError) {
                        throw queryError;
                    }
                    totalPages = Math.ceil((count || 0) / filters.limit);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: {
                                invoices: invoices || [],
                                pagination: {
                                    page: filters.page,
                                    limit: filters.limit,
                                    total: count || 0,
                                    totalPages: totalPages,
                                    hasNext: filters.page < totalPages,
                                    hasPrev: filters.page > 1,
                                },
                            },
                        })];
                case 3:
                    error_1 = _c.sent();
                    console.error('Erreur GET /api/invoices:', error_1);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_1.message || 'Erreur interne du serveur'
                        }, { status: 500 })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.GET = GET;
// POST - Créer une nouvelle facture
function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, body, invoiceData, _b, invoiceNumber, numberError, _c, invoice, insertError, error_2;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _a = _d.sent(), user = _a.user, error = _a.error, status = _a.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    // Vérifier les permissions
                    if (!hasPermission(user, 'create_invoice')) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: 'Permission refusée' }, { status: 403 })];
                    }
                    return [4 /*yield*/, request.json()];
                case 2:
                    body = _d.sent();
                    invoiceData = createInvoiceSchema.parse(body);
                    return [4 /*yield*/, supabase_1.supabase
                            .rpc('generate_invoice_number', {
                            pressing_id: user.pressing_id
                        })];
                case 3:
                    _b = _d.sent(), invoiceNumber = _b.data, numberError = _b.error;
                    if (numberError) {
                        throw new Error('Erreur lors de la génération du numéro de facture');
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .insert({
                            pressing_id: user.pressing_id,
                            number: invoiceNumber,
                            client_name: invoiceData.clientName,
                            client_phone: invoiceData.clientPhone,
                            client_email: invoiceData.clientEmail,
                            client_address: invoiceData.clientAddress,
                            items: invoiceData.items,
                            subtotal: invoiceData.subtotal,
                            discount: invoiceData.discount,
                            discount_type: invoiceData.discountType,
                            tax: invoiceData.tax,
                            total: invoiceData.total,
                            status: 'active',
                            paid: false,
                            withdrawn: false,
                            deposit_date: invoiceData.depositDate,
                            estimated_ready_date: invoiceData.estimatedReadyDate,
                            created_by: user.id,
                            created_by_name: user.full_name,
                            notes: invoiceData.notes,
                            urgency: invoiceData.urgency,
                            tags: invoiceData.tags,
                        })
                            .select()
                            .single()];
                case 4:
                    _c = _d.sent(), invoice = _c.data, insertError = _c.error;
                    if (insertError) {
                        throw insertError;
                    }
                    if (!invoiceData.clientPhone) return [3 /*break*/, 6];
                    return [4 /*yield*/, supabase_1.supabase.rpc('update_client_stats', {
                            p_pressing_id: user.pressing_id,
                            p_client_name: invoiceData.clientName,
                            p_client_phone: invoiceData.clientPhone,
                            p_invoice_total: invoiceData.total,
                        })];
                case 5:
                    _d.sent();
                    _d.label = 6;
                case 6: return [2 /*return*/, server_1.NextResponse.json({
                        success: true,
                        data: invoice,
                        message: 'Facture créée avec succès',
                    }, { status: 201 })];
                case 7:
                    error_2 = _d.sent();
                    console.error('Erreur POST /api/invoices:', error_2);
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
                case 8: return [2 /*return*/];
            }
        });
    });
}
exports.POST = POST;
// PUT - Mettre à jour une facture (body doit contenir l'ID)
function PUT(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, body, id, updates, updateData, _b, existingInvoice, fetchError, canModify, _c, updatedInvoice, updateError, error_3;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _a = _d.sent(), user = _a.user, error = _a.error, status = _a.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    return [4 /*yield*/, request.json()];
                case 2:
                    body = _d.sent();
                    id = body.id, updates = __rest(body, ["id"]);
                    if (!id) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'ID de facture requis' }, { status: 400 })];
                    }
                    updateData = updateInvoiceSchema.parse(updates);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .select('id, created_by, status')
                            .eq('id', id)
                            .eq('pressing_id', user.pressing_id)
                            .single()];
                case 3:
                    _b = _d.sent(), existingInvoice = _b.data, fetchError = _b.error;
                    if (fetchError || !existingInvoice) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Facture non trouvée' }, { status: 404 })];
                    }
                    canModify = user.role === 'owner' ||
                        existingInvoice.created_by === user.id ||
                        hasPermission(user, 'cancel_invoice');
                    if (!canModify) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Permission refusée' }, { status: 403 })];
                    }
                    // Empêcher la modification des factures annulées
                    if (existingInvoice.status === 'cancelled' && user.role !== 'owner') {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Impossible de modifier une facture annulée' }, { status: 400 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .update(__assign(__assign({}, updateData), { modified_by: user.id, modified_by_name: user.full_name, modified_at: new Date().toISOString(), updated_at: new Date().toISOString() }))
                            .eq('id', id)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 4:
                    _c = _d.sent(), updatedInvoice = _c.data, updateError = _c.error;
                    if (updateError) {
                        throw updateError;
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: updatedInvoice,
                            message: 'Facture mise à jour avec succès',
                        })];
                case 5:
                    error_3 = _d.sent();
                    console.error('Erreur PUT /api/invoices:', error_3);
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
                case 6: return [2 /*return*/];
            }
        });
    });
}
exports.PUT = PUT;
// DELETE - Supprimer une facture (soft delete en réalité)
function DELETE(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, user, error, status, searchParams, id, _b, deletedInvoice, deleteError, error_4;
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
                    // Seuls les owners peuvent supprimer
                    if (user.role !== 'owner') {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Seuls les propriétaires peuvent supprimer des factures' }, { status: 403 })];
                    }
                    searchParams = new URL(request.url).searchParams;
                    id = searchParams.get('id');
                    if (!id) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'ID de facture requis' }, { status: 400 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .update({
                            status: 'cancelled',
                            cancellation_reason: 'Suppression par le propriétaire',
                            cancelled_by: user.id,
                            cancelled_at: new Date().toISOString(),
                            modified_by: user.id,
                            modified_by_name: user.full_name,
                            modified_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', id)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 2:
                    _b = _c.sent(), deletedInvoice = _b.data, deleteError = _b.error;
                    if (deleteError) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Facture non trouvée' }, { status: 404 })];
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: deletedInvoice,
                            message: 'Facture supprimée avec succès',
                        })];
                case 3:
                    error_4 = _c.sent();
                    console.error('Erreur DELETE /api/invoices:', error_4);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_4.message || 'Erreur interne du serveur'
                        }, { status: 500 })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.DELETE = DELETE;
