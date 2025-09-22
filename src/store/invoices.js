"use strict";
// =============================================================================
// STORE FACTURES - Digit PRESSING
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTodayStats = exports.useCurrentInvoice = exports.useInvoiceFilters = exports.useInvoiceActions = exports.useInvoices = exports.useInvoicesStore = void 0;
var zustand_1 = require("zustand");
var middleware_1 = require("zustand/middleware");
var supabase_1 = require("@/lib/supabase");
var auth_1 = require("./auth");
var initialFilters = {
    status: undefined,
    paid: undefined,
    withdrawn: undefined,
    urgency: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    clientName: undefined,
    createdBy: undefined,
    minAmount: undefined,
    maxAmount: undefined,
    tags: undefined,
};
var initialSort = {
    field: 'createdAt',
    direction: 'desc',
};
var initialPagination = {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
};
exports.useInvoicesStore = (0, zustand_1.create)()((0, middleware_1.subscribeWithSelector)(function (set, get) { return ({
    // État initial
    invoices: [],
    currentInvoice: null,
    filters: initialFilters,
    sort: initialSort,
    pagination: initialPagination,
    todayStats: null,
    isLoading: false,
    error: null,
    lastUpdated: undefined,
    // Actions
    fetchInvoices: function (options) {
        if (options === void 0) { options = {}; }
        return __awaiter(void 0, void 0, void 0, function () {
            var _a, reset, _b, filters, sort, pagination, user, query, paginatedQuery, _c, data, error, count, invoices, totalPages, error_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        _a = options.reset, reset = _a === void 0 ? false : _a;
                        _b = get(), filters = _b.filters, sort = _b.sort, pagination = _b.pagination;
                        user = auth_1.useAuthStore.getState().user;
                        if (!user) {
                            throw new Error('Utilisateur non connecté');
                        }
                        if (reset || get().invoices.length === 0) {
                            set({ isLoading: true, error: null });
                        }
                        query = supabase_1.supabase
                            .from('invoices')
                            .select('*', { count: 'exact' })
                            .eq('pressing_id', user.pressingId);
                        // Application des filtres
                        if (filters.status && filters.status.length > 0) {
                            query = query.in('status', filters.status);
                        }
                        if (filters.paid !== undefined) {
                            query = query.eq('paid', filters.paid);
                        }
                        if (filters.withdrawn !== undefined) {
                            query = query.eq('withdrawn', filters.withdrawn);
                        }
                        if (filters.urgency && filters.urgency.length > 0) {
                            query = query.in('urgency', filters.urgency);
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
                        if (filters.createdBy && filters.createdBy.length > 0) {
                            query = query.in('created_by', filters.createdBy);
                        }
                        if (filters.minAmount) {
                            query = query.gte('total', filters.minAmount);
                        }
                        if (filters.maxAmount) {
                            query = query.lte('total', filters.maxAmount);
                        }
                        if (filters.tags && filters.tags.length > 0) {
                            query = query.overlaps('tags', filters.tags);
                        }
                        // Application du tri
                        query = query.order(sort.field, { ascending: sort.direction === 'asc' });
                        paginatedQuery = (0, supabase_1.paginateQuery)(query, pagination.page, pagination.limit);
                        return [4 /*yield*/, paginatedQuery];
                    case 1:
                        _c = _d.sent(), data = _c.data, error = _c.error, count = _c.count;
                        if (error) {
                            throw error;
                        }
                        invoices = (data === null || data === void 0 ? void 0 : data.map(function (row) { return ({
                            id: row.id,
                            number: row.number,
                            pressingId: row.pressing_id,
                            clientName: row.client_name,
                            clientPhone: row.client_phone || null,
                            clientEmail: row.client_email || null,
                            clientAddress: row.client_address || null,
                            items: row.items,
                            subtotal: row.subtotal,
                            discount: row.discount || null,
                            discountType: row.discount_type,
                            tax: row.tax || null,
                            total: row.total,
                            status: row.status,
                            paid: row.paid,
                            withdrawn: row.withdrawn,
                            paymentMethod: row.payment_method || null,
                            depositDate: row.deposit_date,
                            paymentDate: row.payment_date || null,
                            withdrawalDate: row.withdrawal_date || null,
                            estimatedReadyDate: row.estimated_ready_date || null,
                            createdBy: row.created_by,
                            createdByName: row.created_by_name,
                            modifiedBy: row.modified_by || null,
                            modifiedByName: row.modified_by_name || null,
                            modifiedAt: row.modified_at || null,
                            cancellationReason: row.cancellation_reason || null,
                            cancelledBy: row.cancelled_by || null,
                            cancelledAt: row.cancelled_at || null,
                            notes: row.notes || null,
                            urgency: row.urgency,
                            tags: row.tags || null,
                            createdAt: row.created_at,
                            updatedAt: row.updated_at,
                        }); })) || [];
                        totalPages = Math.ceil((count || 0) / pagination.limit);
                        set({
                            invoices: invoices,
                            pagination: __assign(__assign({}, pagination), { total: count || 0, totalPages: totalPages }),
                            isLoading: false,
                            lastUpdated: new Date().toISOString(),
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _d.sent();
                        console.error('Erreur lors du chargement des factures:', error_1);
                        set({
                            error: error_1.message || 'Erreur lors du chargement des factures',
                            isLoading: false,
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    },
    searchInvoices: function (searchTerm) { return __awaiter(void 0, void 0, void 0, function () {
        var user, _a, data, error, invoices, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    user = auth_1.useAuthStore.getState().user;
                    if (!user)
                        throw new Error('Utilisateur non connecté');
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase
                            .rpc('search_invoices', {
                            pressing_id: user.pressingId,
                            search_term: searchTerm,
                            limit_count: 100,
                            offset_count: 0,
                        })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    invoices = (data === null || data === void 0 ? void 0 : data.invoices) || [];
                    set({
                        invoices: invoices,
                        pagination: __assign(__assign({}, get().pagination), { total: (data === null || data === void 0 ? void 0 : data.total_count) || 0 }),
                        isLoading: false,
                        lastUpdated: new Date().toISOString(),
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _b.sent();
                    console.error('Erreur lors de la recherche:', error_2);
                    set({
                        error: error_2.message || 'Erreur lors de la recherche',
                        isLoading: false,
                    });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); },
    createInvoice: function (invoiceData) { return __awaiter(void 0, void 0, void 0, function () {
        var user, invoiceNumber, _a, _b, data, error, newInvoice_1, error_3;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 4, , 5]);
                    user = auth_1.useAuthStore.getState().user;
                    if (!user)
                        throw new Error('Utilisateur non connecté');
                    set({ isLoading: true, error: null });
                    _a = invoiceData.number;
                    if (_a) return [3 /*break*/, 2];
                    return [4 /*yield*/, get().generateInvoiceNumber()];
                case 1:
                    _a = (_c.sent());
                    _c.label = 2;
                case 2:
                    invoiceNumber = _a;
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .insert({
                            pressing_id: user.pressingId,
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
                            status: invoiceData.status,
                            paid: invoiceData.paid,
                            payment_method: invoiceData.paymentMethod,
                            deposit_date: invoiceData.depositDate,
                            payment_date: invoiceData.paymentDate,
                            estimated_ready_date: invoiceData.estimatedReadyDate,
                            created_by: user.id,
                            created_by_name: user.fullName,
                            notes: invoiceData.notes,
                            urgency: invoiceData.urgency,
                            tags: invoiceData.tags,
                        })
                            .select()
                            .single()];
                case 3:
                    _b = _c.sent(), data = _b.data, error = _b.error;
                    if (error) {
                        throw error;
                    }
                    newInvoice_1 = {
                        id: data.id,
                        number: data.number,
                        pressingId: data.pressing_id,
                        clientName: data.client_name,
                        clientPhone: data.client_phone || null,
                        clientEmail: data.client_email || null,
                        clientAddress: data.client_address || null,
                        items: data.items,
                        subtotal: data.subtotal,
                        discount: data.discount || null,
                        discountType: data.discount_type || null,
                        tax: data.tax || null,
                        total: data.total,
                        status: data.status,
                        paid: data.paid,
                        withdrawn: data.withdrawn,
                        paymentMethod: data.payment_method || null,
                        depositDate: data.deposit_date,
                        paymentDate: data.payment_date || null,
                        withdrawalDate: data.withdrawal_date || null,
                        estimatedReadyDate: data.estimated_ready_date || null,
                        createdBy: data.created_by,
                        createdByName: data.created_by_name,
                        modifiedBy: data.modified_by || null,
                        modifiedByName: data.modified_by_name || null,
                        modifiedAt: data.modified_at || null,
                        cancellationReason: data.cancellation_reason || null,
                        cancelledBy: data.cancelled_by || null,
                        cancelledAt: data.cancelled_at || null,
                        notes: data.notes || null,
                        urgency: data.urgency,
                        tags: data.tags || null,
                        createdAt: data.created_at,
                        updatedAt: data.updated_at,
                    };
                    // Mettre à jour la liste des factures
                    set(function (state) { return ({
                        invoices: __spreadArray([newInvoice_1], state.invoices, true),
                        pagination: __assign(__assign({}, state.pagination), { total: state.pagination.total + 1 }),
                        isLoading: false,
                    }); });
                    return [2 /*return*/, newInvoice_1];
                case 4:
                    error_3 = _c.sent();
                    console.error('Erreur lors de la création de facture:', error_3);
                    set({
                        error: error_3.message || 'Erreur lors de la création de facture',
                        isLoading: false,
                    });
                    throw error_3;
                case 5: return [2 /*return*/];
            }
        });
    }); },
    updateInvoice: function (id, updates) { return __awaiter(void 0, void 0, void 0, function () {
        var user_1, _a, data, error, error_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    user_1 = auth_1.useAuthStore.getState().user;
                    if (!user_1)
                        throw new Error('Utilisateur non connecté');
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .update(__assign(__assign({}, updates), { modified_by: user_1.id, modified_by_name: user_1.fullName, modified_at: new Date().toISOString(), updated_at: new Date().toISOString() }))
                            .eq('id', id)
                            .eq('pressing_id', user_1.pressingId)
                            .select()
                            .single()];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    // Mettre à jour la liste des factures
                    set(function (state) {
                        var _a;
                        return ({
                            invoices: state.invoices.map(function (invoice) {
                                return invoice.id === id
                                    ? __assign(__assign(__assign({}, invoice), updates), { modifiedBy: user_1.id, modifiedByName: user_1.fullName, modifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) : invoice;
                            }),
                            currentInvoice: ((_a = state.currentInvoice) === null || _a === void 0 ? void 0 : _a.id) === id
                                ? __assign(__assign({}, state.currentInvoice), updates) : state.currentInvoice,
                            isLoading: false,
                        });
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _b.sent();
                    console.error('Erreur lors de la mise à jour de facture:', error_4);
                    set({
                        error: error_4.message || 'Erreur lors de la mise à jour de facture',
                        isLoading: false,
                    });
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    cancelInvoice: function (id, reason) { return __awaiter(void 0, void 0, void 0, function () {
        var user_2, error, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    user_2 = auth_1.useAuthStore.getState().user;
                    if (!user_2)
                        throw new Error('Utilisateur non connecté');
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .update({
                            status: 'cancelled',
                            cancellation_reason: reason,
                            cancelled_by: user_2.id,
                            cancelled_at: new Date().toISOString(),
                            modified_by: user_2.id,
                            modified_by_name: user_2.fullName,
                            modified_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', id)
                            .eq('pressing_id', user_2.pressingId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        throw error;
                    }
                    // Mettre à jour la liste des factures
                    set(function (state) { return ({
                        invoices: state.invoices.map(function (invoice) {
                            return invoice.id === id
                                ? __assign(__assign({}, invoice), { status: 'cancelled', cancellationReason: reason, cancelledBy: user_2.id, cancelledAt: new Date().toISOString() }) : invoice;
                        }),
                        isLoading: false,
                    }); });
                    return [3 /*break*/, 3];
                case 2:
                    error_5 = _a.sent();
                    console.error('Erreur lors de l\'annulation de facture:', error_5);
                    set({
                        error: error_5.message || 'Erreur lors de l\'annulation de facture',
                        isLoading: false,
                    });
                    throw error_5;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    markAsPaid: function (id, paymentMethod, paymentDate) { return __awaiter(void 0, void 0, void 0, function () {
        var user, error, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    user = auth_1.useAuthStore.getState().user;
                    if (!user)
                        throw new Error('Utilisateur non connecté');
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .update({
                            paid: true,
                            payment_method: paymentMethod,
                            payment_date: paymentDate || new Date().toISOString().split('T')[0],
                            modified_by: user.id,
                            modified_by_name: user.fullName,
                            modified_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', id)
                            .eq('pressing_id', user.pressingId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        throw error;
                    }
                    // Mettre à jour la liste des factures
                    set(function (state) { return ({
                        invoices: state.invoices.map(function (invoice) {
                            return invoice.id === id
                                ? __assign(__assign({}, invoice), { paid: true, paymentMethod: paymentMethod, paymentDate: paymentDate || new Date().toISOString().split('T')[0] }) : invoice;
                        }),
                        isLoading: false,
                    }); });
                    return [3 /*break*/, 3];
                case 2:
                    error_6 = _a.sent();
                    console.error('Erreur lors du marquage comme payé:', error_6);
                    set({
                        error: error_6.message || 'Erreur lors du marquage comme payé',
                        isLoading: false,
                    });
                    throw error_6;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    markAsWithdrawn: function (id, withdrawalDate) { return __awaiter(void 0, void 0, void 0, function () {
        var user, error, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    user = auth_1.useAuthStore.getState().user;
                    if (!user)
                        throw new Error('Utilisateur non connecté');
                    set({ isLoading: true, error: null });
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .update({
                            withdrawn: true,
                            withdrawal_date: withdrawalDate || new Date().toISOString().split('T')[0],
                            modified_by: user.id,
                            modified_by_name: user.fullName,
                            modified_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', id)
                            .eq('pressing_id', user.pressingId)];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        throw error;
                    }
                    // Mettre à jour la liste des factures
                    set(function (state) { return ({
                        invoices: state.invoices.map(function (invoice) {
                            return invoice.id === id
                                ? __assign(__assign({}, invoice), { withdrawn: true, withdrawalDate: withdrawalDate || new Date().toISOString().split('T')[0] }) : invoice;
                        }),
                        isLoading: false,
                    }); });
                    return [3 /*break*/, 3];
                case 2:
                    error_7 = _a.sent();
                    console.error('Erreur lors du marquage comme retiré:', error_7);
                    set({
                        error: error_7.message || 'Erreur lors du marquage comme retiré',
                        isLoading: false,
                    });
                    throw error_7;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    duplicateInvoice: function (id) { return __awaiter(void 0, void 0, void 0, function () {
        var invoices, originalInvoice, duplicatedInvoiceData, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    invoices = get().invoices;
                    originalInvoice = invoices.find(function (inv) { return inv.id === id; });
                    if (!originalInvoice) {
                        throw new Error('Facture non trouvée');
                    }
                    duplicatedInvoiceData = __assign(__assign({}, originalInvoice), { number: '', depositDate: new Date().toISOString().split('T')[0], paid: false, withdrawn: false, paymentDate: undefined, withdrawalDate: undefined, paymentMethod: undefined, notes: originalInvoice.notes ? "Copie de ".concat(originalInvoice.number, ": ").concat(originalInvoice.notes) : "Copie de ".concat(originalInvoice.number) });
                    return [4 /*yield*/, get().createInvoice(duplicatedInvoiceData)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_8 = _a.sent();
                    console.error('Erreur lors de la duplication de facture:', error_8);
                    set({
                        error: error_8.message || 'Erreur lors de la duplication de facture',
                        isLoading: false,
                    });
                    throw error_8;
                case 3: return [2 /*return*/];
            }
        });
    }); },
    generateInvoiceNumber: function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, _a, data, error, error_9, now, year, month, day, time;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    user = auth_1.useAuthStore.getState().user;
                    if (!user)
                        throw new Error('Utilisateur non connecté');
                    return [4 /*yield*/, supabase_1.supabase
                            .rpc('generate_invoice_number', {
                            pressing_id: user.pressingId
                        })];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    return [2 /*return*/, data];
                case 2:
                    error_9 = _b.sent();
                    console.error('Erreur lors de la génération du numéro:', error_9);
                    now = new Date();
                    year = now.getFullYear();
                    month = String(now.getMonth() + 1).padStart(2, '0');
                    day = String(now.getDate()).padStart(2, '0');
                    time = String(Date.now()).slice(-4);
                    return [2 /*return*/, "".concat(year).concat(month).concat(day, "-").concat(time)];
                case 3: return [2 /*return*/];
            }
        });
    }); },
    setFilters: function (newFilters) {
        set(function (state) { return ({
            filters: __assign(__assign({}, state.filters), newFilters),
            pagination: __assign(__assign({}, state.pagination), { page: 1 }), // Reset to first page
        }); });
        // Recharger les factures avec les nouveaux filtres
        get().fetchInvoices({ reset: true });
    },
    setSort: function (newSort) {
        set({
            sort: newSort,
            pagination: __assign(__assign({}, get().pagination), { page: 1 })
        });
        // Recharger les factures avec le nouveau tri
        get().fetchInvoices({ reset: true });
    },
    setPagination: function (page, limit) {
        set(function (state) { return ({
            pagination: __assign(__assign({}, state.pagination), { page: page, limit: limit || state.pagination.limit })
        }); });
        // Recharger les factures pour la nouvelle page
        get().fetchInvoices();
    },
    resetFilters: function () {
        set({
            filters: initialFilters,
            sort: initialSort,
            pagination: initialPagination,
        });
        // Recharger les factures sans filtres
        get().fetchInvoices({ reset: true });
    },
    fetchTodayStats: function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, today, _a, data, error, invoices, totalInvoices, paidInvoices, pendingInvoices, totalRevenue, averageTicket, error_10;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    user = auth_1.useAuthStore.getState().user;
                    if (!user)
                        throw new Error('Utilisateur non connecté');
                    today = new Date().toISOString().split('T')[0];
                    return [4 /*yield*/, supabase_1.supabase
                            .from('invoices')
                            .select('*')
                            .eq('pressing_id', user.pressingId)
                            .eq('deposit_date', today)
                            .eq('status', 'active')];
                case 1:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        throw error;
                    }
                    invoices = data || [];
                    totalInvoices = invoices.length;
                    paidInvoices = invoices.filter(function (inv) { return inv.paid; }).length;
                    pendingInvoices = totalInvoices - paidInvoices;
                    totalRevenue = invoices.reduce(function (sum, inv) { return sum + (inv.paid ? inv.total : 0); }, 0);
                    averageTicket = totalInvoices > 0 ? totalRevenue / paidInvoices || 0 : 0;
                    set({
                        todayStats: {
                            totalInvoices: totalInvoices,
                            paidInvoices: paidInvoices,
                            pendingInvoices: pendingInvoices,
                            totalRevenue: totalRevenue,
                            averageTicket: averageTicket,
                        }
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_10 = _b.sent();
                    console.error('Erreur lors du chargement des stats du jour:', error_10);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); },
    getInvoicesByStatus: function (status) {
        var invoices = get().invoices;
        return invoices.filter(function (invoice) { return invoice.status === status; });
    },
    getInvoicesByDateRange: function (startDate, endDate) {
        var invoices = get().invoices;
        return invoices.filter(function (invoice) {
            return invoice.depositDate >= startDate && invoice.depositDate <= endDate;
        });
    },
    setCurrentInvoice: function (invoice) {
        set({ currentInvoice: invoice });
    },
    clearError: function () {
        set({ error: null });
    },
    reset: function () {
        set({
            invoices: [],
            currentInvoice: null,
            filters: initialFilters,
            sort: initialSort,
            pagination: initialPagination,
            todayStats: null,
            isLoading: false,
            error: null,
            lastUpdated: undefined,
        });
    },
}); }));
// Sélecteurs optimisés
var useInvoices = function () {
    return (0, exports.useInvoicesStore)(function (state) { return ({
        invoices: state.invoices,
        isLoading: state.isLoading,
        error: state.error,
        pagination: state.pagination,
        lastUpdated: state.lastUpdated,
    }); });
};
exports.useInvoices = useInvoices;
var useInvoiceActions = function () {
    return (0, exports.useInvoicesStore)(function (state) { return ({
        fetchInvoices: state.fetchInvoices,
        searchInvoices: state.searchInvoices,
        createInvoice: state.createInvoice,
        updateInvoice: state.updateInvoice,
        cancelInvoice: state.cancelInvoice,
        markAsPaid: state.markAsPaid,
        markAsWithdrawn: state.markAsWithdrawn,
        duplicateInvoice: state.duplicateInvoice,
        generateInvoiceNumber: state.generateInvoiceNumber,
        clearError: state.clearError,
    }); });
};
exports.useInvoiceActions = useInvoiceActions;
var useInvoiceFilters = function () {
    return (0, exports.useInvoicesStore)(function (state) { return ({
        filters: state.filters,
        sort: state.sort,
        setFilters: state.setFilters,
        setSort: state.setSort,
        resetFilters: state.resetFilters,
    }); });
};
exports.useInvoiceFilters = useInvoiceFilters;
var useCurrentInvoice = function () {
    return (0, exports.useInvoicesStore)(function (state) { return ({
        currentInvoice: state.currentInvoice,
        setCurrentInvoice: state.setCurrentInvoice,
    }); });
};
exports.useCurrentInvoice = useCurrentInvoice;
var useTodayStats = function () {
    return (0, exports.useInvoicesStore)(function (state) { return ({
        todayStats: state.todayStats,
        fetchTodayStats: state.fetchTodayStats,
    }); });
};
exports.useTodayStats = useTodayStats;
// Auto-refresh des stats toutes les 5 minutes
if (typeof window !== 'undefined') {
    setInterval(function () {
        var store = exports.useInvoicesStore.getState();
        var user = auth_1.useAuthStore.getState().user;
        if (user && !store.isLoading) {
            store.fetchTodayStats();
        }
    }, 5 * 60 * 1000); // 5 minutes
}
// Écouter les changements en temps réel
if (typeof window !== 'undefined') {
    var user = auth_1.useAuthStore.getState().user;
    if (user) {
        supabase_1.supabase
            .channel("invoices_".concat(user.pressingId))
            .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'invoices',
            filter: "pressing_id=eq.".concat(user.pressingId),
        }, function (payload) {
            var store = exports.useInvoicesStore.getState();
            switch (payload.eventType) {
                case 'INSERT':
                    // Ajouter la nouvelle facture si elle n'existe pas déjà
                    var newInvoice_2 = payload.new;
                    if (!store.invoices.find(function (inv) { return inv.id === newInvoice_2.id; })) {
                        exports.useInvoicesStore.setState(function (state) { return ({
                            invoices: __spreadArray([newInvoice_2], state.invoices, true),
                            pagination: __assign(__assign({}, state.pagination), { total: state.pagination.total + 1 })
                        }); });
                    }
                    break;
                case 'UPDATE':
                    // Mettre à jour la facture existante
                    var updatedInvoice_1 = payload.new;
                    exports.useInvoicesStore.setState(function (state) {
                        var _a;
                        return ({
                            invoices: state.invoices.map(function (inv) {
                                return inv.id === updatedInvoice_1.id ? updatedInvoice_1 : inv;
                            }),
                            currentInvoice: ((_a = state.currentInvoice) === null || _a === void 0 ? void 0 : _a.id) === updatedInvoice_1.id
                                ? updatedInvoice_1
                                : state.currentInvoice,
                        });
                    });
                    break;
                case 'DELETE':
                    // Retirer la facture supprimée
                    var deletedInvoice_1 = payload.old;
                    exports.useInvoicesStore.setState(function (state) {
                        var _a;
                        return ({
                            invoices: state.invoices.filter(function (inv) { return inv.id !== deletedInvoice_1.id; }),
                            pagination: __assign(__assign({}, state.pagination), { total: Math.max(0, state.pagination.total - 1) }),
                            currentInvoice: ((_a = state.currentInvoice) === null || _a === void 0 ? void 0 : _a.id) === deletedInvoice_1.id
                                ? null
                                : state.currentInvoice,
                        });
                    });
                    break;
            }
            // Actualiser les stats après chaque changement
            store.fetchTodayStats();
        })
            .subscribe();
    }
}
