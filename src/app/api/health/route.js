"use strict";
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
exports.OPTIONS = exports.POST = exports.GET = void 0;
var server_1 = require("next/server");
var supabase_1 = require("@/lib/supabase");
// GET - Vérification de santé du système
function GET(request) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var startTime, checks, systemInfo, dbStartTime, _b, data, error, error_1, authStartTime, _c, data, error, error_2, envVars, missingVars, memoryUsage, memoryHealthy, rpcStartTime, _d, data, error, error_3, unhealthyCount, degradedCount, overallStatus, healthData, statusCode, error_4, criticalHealthData;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    startTime = Date.now();
                    checks = [];
                    systemInfo = {
                        version: process.env.npm_package_version || '1.0.0',
                        environment: process.env.NODE_ENV || 'development',
                        timestamp: new Date().toISOString(),
                        uptime: process.uptime(),
                    };
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 14, , 15]);
                    dbStartTime = Date.now();
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, supabase_1.supabase
                            .from('pressings')
                            .select('id')
                            .limit(1)];
                case 3:
                    _b = _e.sent(), data = _b.data, error = _b.error;
                    if (error)
                        throw error;
                    checks.push({
                        service: 'database',
                        status: 'healthy',
                        responseTime: Date.now() - dbStartTime,
                        details: {
                            connection: 'active',
                            query_test: 'passed',
                        }
                    });
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _e.sent();
                    checks.push({
                        service: 'database',
                        status: 'unhealthy',
                        responseTime: Date.now() - dbStartTime,
                        error: error_1.message,
                        details: {
                            connection: 'failed',
                        }
                    });
                    return [3 /*break*/, 5];
                case 5:
                    authStartTime = Date.now();
                    _e.label = 6;
                case 6:
                    _e.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, supabase_1.supabase.auth.getSession()];
                case 7:
                    _c = _e.sent(), data = _c.data, error = _c.error;
                    checks.push({
                        service: 'auth',
                        status: 'healthy',
                        responseTime: Date.now() - authStartTime,
                        details: {
                            service: 'supabase_auth',
                            status: 'operational',
                        }
                    });
                    return [3 /*break*/, 9];
                case 8:
                    error_2 = _e.sent();
                    checks.push({
                        service: 'auth',
                        status: 'degraded',
                        responseTime: Date.now() - authStartTime,
                        error: error_2.message,
                    });
                    return [3 /*break*/, 9];
                case 9:
                    envVars = [
                        'NEXT_PUBLIC_SUPABASE_URL',
                        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
                    ];
                    missingVars = envVars.filter(function (varName) { return !process.env[varName]; });
                    checks.push({
                        service: 'environment',
                        status: missingVars.length === 0 ? 'healthy' : 'unhealthy',
                        details: {
                            required_vars: envVars.length,
                            missing_vars: missingVars,
                            environment: process.env.NODE_ENV,
                        },
                        error: missingVars.length > 0 ? "Variables manquantes: ".concat(missingVars.join(', ')) : undefined,
                    });
                    memoryUsage = process.memoryUsage();
                    memoryHealthy = memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9;
                    checks.push({
                        service: 'system',
                        status: memoryHealthy ? 'healthy' : 'degraded',
                        details: {
                            memory: {
                                used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                                total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                                usage_percent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
                            },
                            uptime_seconds: Math.round(process.uptime()),
                            node_version: process.version,
                        },
                        error: !memoryHealthy ? 'Utilisation mémoire élevée' : undefined,
                    });
                    if (!(((_a = checks.find(function (c) { return c.service === 'database'; })) === null || _a === void 0 ? void 0 : _a.status) === 'healthy')) return [3 /*break*/, 13];
                    rpcStartTime = Date.now();
                    _e.label = 10;
                case 10:
                    _e.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, supabase_1.supabase.rpc('generate_invoice_number', {
                            pressing_id: '00000000-0000-0000-0000-000000000000' // UUID factice
                        })];
                case 11:
                    _d = _e.sent(), data = _d.data, error = _d.error;
                    checks.push({
                        service: 'rpc_functions',
                        status: 'healthy',
                        responseTime: Date.now() - rpcStartTime,
                        details: {
                            test_function: 'generate_invoice_number',
                            result: 'success',
                        }
                    });
                    return [3 /*break*/, 13];
                case 12:
                    error_3 = _e.sent();
                    checks.push({
                        service: 'rpc_functions',
                        status: 'degraded',
                        responseTime: Date.now() - rpcStartTime,
                        error: error_3.message,
                        details: {
                            test_function: 'generate_invoice_number',
                            result: 'failed',
                        }
                    });
                    return [3 /*break*/, 13];
                case 13:
                    unhealthyCount = checks.filter(function (c) { return c.status === 'unhealthy'; }).length;
                    degradedCount = checks.filter(function (c) { return c.status === 'degraded'; }).length;
                    overallStatus = void 0;
                    if (unhealthyCount > 0) {
                        overallStatus = 'unhealthy';
                    }
                    else if (degradedCount > 0) {
                        overallStatus = 'degraded';
                    }
                    else {
                        overallStatus = 'healthy';
                    }
                    healthData = {
                        status: overallStatus,
                        timestamp: systemInfo.timestamp,
                        version: systemInfo.version,
                        environment: systemInfo.environment,
                        checks: checks,
                        uptime: systemInfo.uptime,
                    };
                    statusCode = overallStatus === 'healthy' ? 200 :
                        overallStatus === 'degraded' ? 200 : 503;
                    return [2 /*return*/, server_1.NextResponse.json(healthData, { status: statusCode })];
                case 14:
                    error_4 = _e.sent();
                    criticalHealthData = {
                        status: 'unhealthy',
                        timestamp: new Date().toISOString(),
                        version: systemInfo.version,
                        environment: systemInfo.environment,
                        checks: [
                            {
                                service: 'system',
                                status: 'unhealthy',
                                error: error_4.message,
                                details: {
                                    critical_error: true,
                                    error_type: error_4.constructor.name,
                                }
                            }
                        ],
                        uptime: systemInfo.uptime,
                    };
                    console.error('Erreur critique dans health check:', error_4);
                    return [2 /*return*/, server_1.NextResponse.json(criticalHealthData, { status: 503 })];
                case 15: return [2 /*return*/];
            }
        });
    });
}
exports.GET = GET;
// POST - Déclenchement de tests de santé étendus (pour le monitoring)
function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var body, _a, tests, _b, timeout_1, results, availableTests, _i, tests_1, testName, testResult, error_5, _c, _d, error_6;
        var _this = this;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 12, , 13]);
                    return [4 /*yield*/, request.json()];
                case 1:
                    body = _e.sent();
                    _a = body.tests, tests = _a === void 0 ? [] : _a, _b = body.timeout, timeout_1 = _b === void 0 ? 10000 : _b;
                    results = {
                        timestamp: new Date().toISOString(),
                        requested_tests: tests,
                        results: [],
                    };
                    availableTests = {
                        'database_performance': function () { return __awaiter(_this, void 0, void 0, function () {
                            var start, _a, data, error;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        start = Date.now();
                                        return [4 /*yield*/, supabase_1.supabase
                                                .from('invoices')
                                                .select('id, created_at')
                                                .limit(100)
                                                .order('created_at', { ascending: false })];
                                    case 1:
                                        _a = _b.sent(), data = _a.data, error = _a.error;
                                        return [2 /*return*/, {
                                                test: 'database_performance',
                                                status: error ? 'failed' : 'passed',
                                                duration: Date.now() - start,
                                                details: {
                                                    records_fetched: (data === null || data === void 0 ? void 0 : data.length) || 0,
                                                    query_type: 'SELECT with ORDER BY and LIMIT',
                                                },
                                                error: error === null || error === void 0 ? void 0 : error.message,
                                            }];
                                }
                            });
                        }); },
                        'auth_flow': function () { return __awaiter(_this, void 0, void 0, function () {
                            var start, _a, data, error, err_1;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        start = Date.now();
                                        _b.label = 1;
                                    case 1:
                                        _b.trys.push([1, 5, , 6]);
                                        return [4 /*yield*/, supabase_1.supabase.auth.signInAnonymously()];
                                    case 2:
                                        _a = _b.sent(), data = _a.data, error = _a.error;
                                        if (!data.session) return [3 /*break*/, 4];
                                        return [4 /*yield*/, supabase_1.supabase.auth.signOut()];
                                    case 3:
                                        _b.sent();
                                        _b.label = 4;
                                    case 4: return [2 /*return*/, {
                                            test: 'auth_flow',
                                            status: error ? 'failed' : 'passed',
                                            duration: Date.now() - start,
                                            details: {
                                                flow_type: 'anonymous_signin_signout',
                                                session_created: !!data.session,
                                            },
                                            error: error === null || error === void 0 ? void 0 : error.message,
                                        }];
                                    case 5:
                                        err_1 = _b.sent();
                                        return [2 /*return*/, {
                                                test: 'auth_flow',
                                                status: 'failed',
                                                duration: Date.now() - start,
                                                error: err_1.message,
                                            }];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        }); },
                        'rpc_performance': function () { return __awaiter(_this, void 0, void 0, function () {
                            var start, testPromises, i, results_1, successful, err_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        start = Date.now();
                                        testPromises = [];
                                        // Test multiple RPC calls
                                        for (i = 0; i < 5; i++) {
                                            testPromises.push(supabase_1.supabase.rpc('generate_invoice_number', {
                                                pressing_id: '00000000-0000-0000-0000-000000000000'
                                            }));
                                        }
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, Promise.allSettled(testPromises)];
                                    case 2:
                                        results_1 = _a.sent();
                                        successful = results_1.filter(function (r) { return r.status === 'fulfilled'; }).length;
                                        return [2 /*return*/, {
                                                test: 'rpc_performance',
                                                status: successful === testPromises.length ? 'passed' : 'partial',
                                                duration: Date.now() - start,
                                                details: {
                                                    concurrent_calls: testPromises.length,
                                                    successful_calls: successful,
                                                    success_rate: (successful / testPromises.length) * 100,
                                                },
                                            }];
                                    case 3:
                                        err_2 = _a.sent();
                                        return [2 /*return*/, {
                                                test: 'rpc_performance',
                                                status: 'failed',
                                                duration: Date.now() - start,
                                                error: err_2.message,
                                            }];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); },
                        'memory_stress': function () { return __awaiter(_this, void 0, void 0, function () {
                            var start, initialMemory, largeArray, memoryAfterAllocation, finalMemory;
                            return __generator(this, function (_a) {
                                start = Date.now();
                                initialMemory = process.memoryUsage();
                                largeArray = new Array(100000).fill('test data for memory stress');
                                memoryAfterAllocation = process.memoryUsage();
                                // Nettoyer
                                largeArray.length = 0;
                                if (global.gc) {
                                    global.gc();
                                }
                                finalMemory = process.memoryUsage();
                                return [2 /*return*/, {
                                        test: 'memory_stress',
                                        status: 'passed',
                                        duration: Date.now() - start,
                                        details: {
                                            initial_heap_mb: Math.round(initialMemory.heapUsed / 1024 / 1024),
                                            peak_heap_mb: Math.round(memoryAfterAllocation.heapUsed / 1024 / 1024),
                                            final_heap_mb: Math.round(finalMemory.heapUsed / 1024 / 1024),
                                            memory_increase_mb: Math.round((memoryAfterAllocation.heapUsed - initialMemory.heapUsed) / 1024 / 1024),
                                            gc_available: !!global.gc,
                                        },
                                    }];
                            });
                        }); },
                    };
                    _i = 0, tests_1 = tests;
                    _e.label = 2;
                case 2:
                    if (!(_i < tests_1.length)) return [3 /*break*/, 9];
                    testName = tests_1[_i];
                    if (!availableTests[testName]) return [3 /*break*/, 7];
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, Promise.race([
                            availableTests[testName](),
                            new Promise(function (_, reject) {
                                return setTimeout(function () { return reject(new Error('Test timeout')); }, timeout_1);
                            })
                        ])];
                case 4:
                    testResult = _e.sent();
                    results.results.push(testResult);
                    return [3 /*break*/, 6];
                case 5:
                    error_5 = _e.sent();
                    results.results.push({
                        test: testName,
                        status: 'failed',
                        error: error_5.message,
                    });
                    return [3 /*break*/, 6];
                case 6: return [3 /*break*/, 8];
                case 7:
                    results.results.push({
                        test: testName,
                        status: 'skipped',
                        error: 'Test non disponible',
                    });
                    _e.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 2];
                case 9:
                    if (!(tests.length === 0)) return [3 /*break*/, 11];
                    _d = (_c = results.results).push;
                    return [4 /*yield*/, availableTests.database_performance()];
                case 10:
                    _d.apply(_c, [_e.sent()]);
                    _e.label = 11;
                case 11: return [2 /*return*/, server_1.NextResponse.json({
                        success: true,
                        data: results,
                    })];
                case 12:
                    error_6 = _e.sent();
                    console.error('Erreur POST /api/health:', error_6);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            error: error_6.message || 'Erreur interne du serveur',
                            timestamp: new Date().toISOString(),
                        }, { status: 500 })];
                case 13: return [2 /*return*/];
            }
        });
    });
}
exports.POST = POST;
// OPTIONS - Informations sur les tests disponibles
function OPTIONS() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, server_1.NextResponse.json({
                    available_tests: [
                        {
                            name: 'database_performance',
                            description: 'Test de performance de la base de données',
                            duration: 'Rapide (< 1s)',
                        },
                        {
                            name: 'auth_flow',
                            description: 'Test du flux d\'authentification',
                            duration: 'Moyen (1-3s)',
                        },
                        {
                            name: 'rpc_performance',
                            description: 'Test de performance des fonctions RPC',
                            duration: 'Moyen (2-5s)',
                        },
                        {
                            name: 'memory_stress',
                            description: 'Test de stress mémoire léger',
                            duration: 'Rapide (< 1s)',
                        },
                    ],
                    usage: {
                        get: 'Vérification de santé standard du système',
                        post: 'Tests de santé étendus avec paramètres personnalisés',
                        options: 'Liste des tests disponibles',
                    },
                    example_request: {
                        method: 'POST',
                        body: {
                            tests: ['database_performance', 'auth_flow'],
                            timeout: 10000,
                        },
                    },
                })];
        });
    });
}
exports.OPTIONS = OPTIONS;
