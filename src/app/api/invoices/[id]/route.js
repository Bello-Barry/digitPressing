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
// Schéma pour les actions spécifiques
var actionSchema = zod_1.z.object({
    action: zod_1.z.enum(['pay', 'withdraw', 'cancel', 'duplicate']),
    paymentMethod: zod_1.z.enum(['cash', 'card', 'check', 'transfer', 'mobile_money']).optional(),
    paymentDate: zod_1.z.string().optional(),
    withdrawalDate: zod_1.z.string().optional(),
    cancellationReason: zod_1.z.string().optional(),
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
// GET - Récupérer une facture spécifique
function GET(request, _a) {
    var _b, _c;
    var params = _a.params;
    return __awaiter(this, void 0, void 0, function () {
        var _d, user, error, status, invoiceId, _e, invoice, fetchError, stats, error_1;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _d = _f.sent(), user = _d.user, error = _d.error, status = _d.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    invoiceId = params.id;
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .select("\n        *,\n        created_by_user:users!invoices_created_by_fkey(full_name, email),\n        modified_by_user:users!invoices_modified_by_fkey(full_name, email),\n        cancelled_by_user:users!invoices_cancelled_by_fkey(full_name, email)\n      ")
                            .eq('id', invoiceId)
                            .eq('pressing_id', user.pressing_id)
                            .single()];
                case 2:
                    _e = _f.sent(), invoice = _e.data, fetchError = _e.error;
                    if (fetchError || !invoice) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Facture non trouvée' }, { status: 404 })];
                    }
                    stats = {
                        itemsCount: ((_b = invoice.items) === null || _b === void 0 ? void 0 : _b.length) || 0,
                        averageItemPrice: ((_c = invoice.items) === null || _c === void 0 ? void 0 : _c.length) > 0
                            ? invoice.subtotal / invoice.items.reduce(function (sum, item) { return sum + item.quantity; }, 0)
                            : 0,
                        daysSinceCreated: Math.floor((new Date().getTime() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                        isOverdue: invoice.estimated_ready_date
                            ? new Date(invoice.estimated_ready_date) < new Date() && !invoice.withdrawn
                            : false,
                    };
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: __assign(__assign({}, invoice), { stats: stats }),
                        })];
                case 3:
                    error_1 = _f.sent();
                    console.error("Erreur GET /api/invoices/".concat(params.id, ":"), error_1);
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
// POST - Actions spécifiques sur une facture
function POST(request, _a) {
    var params = _a.params;
    return __awaiter(this, void 0, void 0, function () {
        var _b, user, error, status, invoiceId, body, _c, action, actionData, _d, existingInvoice, fetchError, updatedInvoice, message, _e, _f, paidInvoice, payError, _g, withdrawnInvoice, withdrawError, _h, cancelledInvoice, cancelError, _j, newNumber, numberError, _k, duplicatedInvoice, duplicateError, error_2;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    _l.trys.push([0, 17, , 18]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _b = _l.sent(), user = _b.user, error = _b.error, status = _b.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    invoiceId = params.id;
                    return [4 /*yield*/, request.json()];
                case 2:
                    body = _l.sent();
                    _c = actionSchema.parse(body), action = _c.action, actionData = __rest(_c, ["action"]);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .select('*')
                            .eq('id', invoiceId)
                            .eq('pressing_id', user.pressing_id)
                            .single()];
                case 3:
                    _d = _l.sent(), existingInvoice = _d.data, fetchError = _d.error;
                    if (fetchError || !existingInvoice) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Facture non trouvée' }, { status: 404 })];
                    }
                    // Vérifier que la facture est active (sauf pour certaines actions)
                    if (existingInvoice.status === 'cancelled' && action !== 'duplicate') {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Action impossible sur une facture annulée' }, { status: 400 })];
                    }
                    updatedInvoice = void 0;
                    message = '';
                    _e = action;
                    switch (_e) {
                        case 'pay': return [3 /*break*/, 4];
                        case 'withdraw': return [3 /*break*/, 6];
                        case 'cancel': return [3 /*break*/, 8];
                        case 'duplicate': return [3 /*break*/, 10];
                    }
                    return [3 /*break*/, 13];
                case 4:
                    // Marquer comme payé
                    if (existingInvoice.paid) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Facture déjà payée' }, { status: 400 })];
                    }
                    if (!actionData.paymentMethod) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Méthode de paiement requise' }, { status: 400 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .update({
                            paid: true,
                            payment_method: actionData.paymentMethod,
                            payment_date: actionData.paymentDate || new Date().toISOString().split('T')[0],
                            modified_by: user.id,
                            modified_by_name: user.full_name,
                            modified_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', invoiceId)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 5:
                    _f = _l.sent(), paidInvoice = _f.data, payError = _f.error;
                    if (payError)
                        throw payError;
                    updatedInvoice = paidInvoice;
                    message = 'Facture marquée comme payée';
                    return [3 /*break*/, 14];
                case 6:
                    // Marquer comme retirée
                    if (!existingInvoice.paid) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'La facture doit être payée avant d\'être retirée' }, { status: 400 })];
                    }
                    if (existingInvoice.withdrawn) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Commande déjà retirée' }, { status: 400 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .update({
                            withdrawn: true,
                            withdrawal_date: actionData.withdrawalDate || new Date().toISOString().split('T')[0],
                            modified_by: user.id,
                            modified_by_name: user.full_name,
                            modified_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', invoiceId)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 7:
                    _g = _l.sent(), withdrawnInvoice = _g.data, withdrawError = _g.error;
                    if (withdrawError)
                        throw withdrawError;
                    updatedInvoice = withdrawnInvoice;
                    message = 'Commande marquée comme retirée';
                    return [3 /*break*/, 14];
                case 8:
                    // Annuler la facture
                    if (!hasPermission(user, 'cancel_invoice') && existingInvoice.created_by !== user.id) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Permission refusée' }, { status: 403 })];
                    }
                    if (!actionData.cancellationReason) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Raison d\'annulation requise' }, { status: 400 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .update({
                            status: 'cancelled',
                            cancellation_reason: actionData.cancellationReason,
                            cancelled_by: user.id,
                            cancelled_at: new Date().toISOString(),
                            modified_by: user.id,
                            modified_by_name: user.full_name,
                            modified_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', invoiceId)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 9:
                    _h = _l.sent(), cancelledInvoice = _h.data, cancelError = _h.error;
                    if (cancelError)
                        throw cancelError;
                    updatedInvoice = cancelledInvoice;
                    message = 'Facture annulée avec succès';
                    return [3 /*break*/, 14];
                case 10:
                    // Dupliquer la facture
                    if (!hasPermission(user, 'create_invoice')) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Permission refusée' }, { status: 403 })];
                    }
                    return [4 /*yield*/, supabase_1.supabase
                            .rpc('generate_invoice_number', {
                            pressing_id: user.pressing_id
                        })];
                case 11:
                    _j = _l.sent(), newNumber = _j.data, numberError = _j.error;
                    if (numberError)
                        throw new Error('Erreur lors de la génération du numéro');
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .insert({
                            pressing_id: user.pressing_id,
                            number: newNumber,
                            client_name: existingInvoice.client_name,
                            client_phone: existingInvoice.client_phone,
                            client_email: existingInvoice.client_email,
                            client_address: existingInvoice.client_address,
                            items: existingInvoice.items,
                            subtotal: existingInvoice.subtotal,
                            discount: existingInvoice.discount,
                            discount_type: existingInvoice.discount_type,
                            tax: existingInvoice.tax,
                            total: existingInvoice.total,
                            status: 'active',
                            paid: false,
                            withdrawn: false,
                            deposit_date: new Date().toISOString().split('T')[0],
                            estimated_ready_date: existingInvoice.estimated_ready_date,
                            created_by: user.id,
                            created_by_name: user.full_name,
                            notes: existingInvoice.notes
                                ? "Copie de ".concat(existingInvoice.number, ": ").concat(existingInvoice.notes)
                                : "Copie de ".concat(existingInvoice.number),
                            urgency: existingInvoice.urgency,
                            tags: existingInvoice.tags,
                        })
                            .select()
                            .single()];
                case 12:
                    _k = _l.sent(), duplicatedInvoice = _k.data, duplicateError = _k.error;
                    if (duplicateError)
                        throw duplicateError;
                    updatedInvoice = duplicatedInvoice;
                    message = 'Facture dupliquée avec succès';
                    return [3 /*break*/, 14];
                case 13: return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Action non reconnue' }, { status: 400 })];
                case 14:
                    if (!(action === 'pay' && existingInvoice.client_phone)) return [3 /*break*/, 16];
                    return [4 /*yield*/, supabase_1.supabase.rpc('update_client_stats', {
                            p_pressing_id: user.pressing_id,
                            p_client_name: existingInvoice.client_name,
                            p_client_phone: existingInvoice.client_phone,
                            p_invoice_total: existingInvoice.total,
                        })];
                case 15:
                    _l.sent();
                    _l.label = 16;
                case 16: return [2 /*return*/, server_1.NextResponse.json({
                        success: true,
                        data: updatedInvoice,
                        message: message,
                    })];
                case 17:
                    error_2 = _l.sent();
                    console.error("Erreur POST /api/invoices/".concat(params.id, ":"), error_2);
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
                case 18: return [2 /*return*/];
            }
        });
    });
}
exports.POST = POST;
// PUT - Mettre à jour une facture spécifique
function PUT(request, _a) {
    var params = _a.params;
    return __awaiter(this, void 0, void 0, function () {
        var _b, user, error, status, invoiceId, body, _c, existingInvoice, fetchError, canModify, _d, updatedInvoice, updateError, error_3;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _b = _e.sent(), user = _b.user, error = _b.error, status = _b.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    invoiceId = params.id;
                    return [4 /*yield*/, request.json()];
                case 2:
                    body = _e.sent();
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .select('id, created_by, status')
                            .eq('id', invoiceId)
                            .eq('pressing_id', user.pressing_id)
                            .single()];
                case 3:
                    _c = _e.sent(), existingInvoice = _c.data, fetchError = _c.error;
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
                            .update(__assign(__assign({}, body), { modified_by: user.id, modified_by_name: user.full_name, modified_at: new Date().toISOString(), updated_at: new Date().toISOString() }))
                            .eq('id', invoiceId)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 4:
                    _d = _e.sent(), updatedInvoice = _d.data, updateError = _d.error;
                    if (updateError) {
                        throw updateError;
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: updatedInvoice,
                            message: 'Facture mise à jour avec succès',
                        })];
                case 5:
                    error_3 = _e.sent();
                    console.error("Erreur PUT /api/invoices/".concat(params.id, ":"), error_3);
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
// DELETE - Supprimer une facture spécifique
function DELETE(request, _a) {
    var params = _a.params;
    return __awaiter(this, void 0, void 0, function () {
        var _b, user, error, status, invoiceId, _c, deletedInvoice, deleteError, error_4;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, verifyAuth(request)];
                case 1:
                    _b = _d.sent(), user = _b.user, error = _b.error, status = _b.status;
                    if (error) {
                        return [2 /*return*/, server_1.NextResponse.json({ error: error }, { status: status })];
                    }
                    invoiceId = params.id;
                    // Seuls les owners peuvent supprimer
                    if (user.role !== 'owner') {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Seuls les propriétaires peuvent supprimer des factures' }, { status: 403 })];
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
                            .eq('id', invoiceId)
                            .eq('pressing_id', user.pressing_id)
                            .select()
                            .single()];
                case 2:
                    _c = _d.sent(), deletedInvoice = _c.data, deleteError = _c.error;
                    if (deleteError) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, error: 'Facture non trouvée' }, { status: 404 })];
                    }
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: true,
                            data: deletedInvoice,
                            message: 'Facture supprimée avec succès',
                        })];
                case 3:
                    error_4 = _d.sent();
                    console.error("Erreur DELETE /api/invoices/".concat(params.id, ":"), error_4);
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
