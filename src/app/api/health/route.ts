import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Types pour le monitoring
interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  details?: any;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: HealthCheck[];
  uptime: number;
}

// GET - Vérification de santé du système
export async function GET() {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];
  
  // Informations système de base
  const systemInfo = {
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  try {
    // 1. Vérification de la base de données Supabase
    const dbStartTime = Date.now();
    try {
      const { data, error } = await supabase
        .from('pressings')
        .select('id')
        .limit(1);
      
      if (error) throw error;
      
      checks.push({
        service: 'database',
        status: 'healthy',
        responseTime: Date.now() - dbStartTime,
        details: {
          connection: 'active',
          query_test: 'passed',
        }
      });
    } catch (error: any) {
      checks.push({
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - dbStartTime,
        error: error.message,
        details: {
          connection: 'failed',
        }
      });
    }

    // 2. Vérification de l'authentification Supabase
    const authStartTime = Date.now();
    try {
      const { data, error } = await supabase.auth.getSession();
      
      checks.push({
        service: 'auth',
        status: 'healthy',
        responseTime: Date.now() - authStartTime,
        details: {
          service: 'supabase_auth',
          status: 'operational',
        }
      });
    } catch (error: any) {
      checks.push({
        service: 'auth',
        status: 'degraded',
        responseTime: Date.now() - authStartTime,
        error: error.message,
      });
    }

    // 3. Vérification des variables d'environnement critiques
    const envVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ];

    const missingVars = envVars.filter(varName => !process.env[varName]);
    
    checks.push({
      service: 'environment',
      status: missingVars.length === 0 ? 'healthy' : 'unhealthy',
      details: {
        required_vars: envVars.length,
        missing_vars: missingVars,
        environment: process.env.NODE_ENV,
      },
      error: missingVars.length > 0 ? `Variables manquantes: ${missingVars.join(', ')}` : undefined,
    });

    // 4. Vérification des performances système
    const memoryUsage = process.memoryUsage();
    const memoryHealthy = memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9;
    
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

    // 5. Test des fonctions RPC critiques (si base de données disponible)
    if (checks.find(c => c.service === 'database')?.status === 'healthy') {
      const rpcStartTime = Date.now();
      try {
        // Tester une fonction RPC simple
        const { data, error } = await supabase.rpc('generate_invoice_number', {
          pressing_id: '00000000-0000-0000-0000-000000000000' // UUID factice
        });
        
        checks.push({
          service: 'rpc_functions',
          status: 'healthy',
          responseTime: Date.now() - rpcStartTime,
          details: {
            test_function: 'generate_invoice_number',
            result: 'success',
          }
        });
      } catch (error: any) {
        checks.push({
          service: 'rpc_functions',
          status: 'degraded',
          responseTime: Date.now() - rpcStartTime,
          error: error.message,
          details: {
            test_function: 'generate_invoice_number',
            result: 'failed',
          }
        });
      }
    }

    // Déterminer l'état global du système
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const healthData: SystemHealth = {
      status: overallStatus,
      timestamp: systemInfo.timestamp,
      version: systemInfo.version,
      environment: systemInfo.environment,
      checks,
      uptime: systemInfo.uptime,
    };

    // Définir le code de statut HTTP approprié
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthData, { status: statusCode });

  } catch (error: any) {
    // En cas d'erreur critique
    const criticalHealthData: SystemHealth = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: systemInfo.version,
      environment: systemInfo.environment,
      checks: [
        {
          service: 'system',
          status: 'unhealthy',
          error: error.message,
          details: {
            critical_error: true,
            error_type: error.constructor.name,
          }
        }
      ],
      uptime: systemInfo.uptime,
    };

    console.error('Erreur critique dans health check:', error);
    return NextResponse.json(criticalHealthData, { status: 503 });
  }
}

// POST - Déclenchement de tests de santé étendus (pour le monitoring)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tests = [], timeout = 10000 } = body;

    const results: any = {
      timestamp: new Date().toISOString(),
      requested_tests: tests,
      results: [],
    };

    // Tests étendus disponibles
    const availableTests = {
      'database_performance': async () => {
        const start = Date.now();
        const { data, error } = await supabase
          .from('invoices')
          .select('id, created_at')
          .limit(100)
          .order('created_at', { ascending: false });
        
        return {
          test: 'database_performance',
          status: error ? 'failed' : 'passed',
          duration: Date.now() - start,
          details: {
            records_fetched: data?.length || 0,
            query_type: 'SELECT with ORDER BY and LIMIT',
          },
          error: error?.message,
        };
      },

      'auth_flow': async () => {
        const start = Date.now();
        try {
          // Test d'un flow d'authentification sans créer de session
          const { data, error } = await supabase.auth.signInAnonymously();
          if (data.session) {
            await supabase.auth.signOut();
          }
          
          return {
            test: 'auth_flow',
            status: error ? 'failed' : 'passed',
            duration: Date.now() - start,
            details: {
              flow_type: 'anonymous_signin_signout',
              session_created: !!data.session,
            },
            error: error?.message,
          };
        } catch (err: any) {
          return {
            test: 'auth_flow',
            status: 'failed',
            duration: Date.now() - start,
            error: err.message,
          };
        }
      },

      'rpc_performance': async () => {
        const start = Date.now();
        const testPromises = [];
        
        // Test multiple RPC calls
        for (let i = 0; i < 5; i++) {
          testPromises.push(
            supabase.rpc('generate_invoice_number', {
              pressing_id: '00000000-0000-0000-0000-000000000000'
            })
          );
        }

        try {
          const results = await Promise.allSettled(testPromises);
          const successful = results.filter(r => r.status === 'fulfilled').length;
          
          return {
            test: 'rpc_performance',
            status: successful === testPromises.length ? 'passed' : 'partial',
            duration: Date.now() - start,
            details: {
              concurrent_calls: testPromises.length,
              successful_calls: successful,
              success_rate: (successful / testPromises.length) * 100,
            },
          };
        } catch (err: any) {
          return {
            test: 'rpc_performance',
            status: 'failed',
            duration: Date.now() - start,
            error: err.message,
          };
        }
      },

      'memory_stress': async () => {
        const start = Date.now();
        const initialMemory = process.memoryUsage();
        
        // Créer un stress test léger
        const largeArray = new Array(100000).fill('test data for memory stress');
        const memoryAfterAllocation = process.memoryUsage();
        
        // Nettoyer
        largeArray.length = 0;
        
        if (global.gc) {
          global.gc();
        }
        
        const finalMemory = process.memoryUsage();
        
        return {
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
        };
      },
    };

    // Exécuter les tests demandés
    for (const testName of tests) {
      if (availableTests[testName as keyof typeof availableTests]) {
        try {
          const testResult = await Promise.race([
            availableTests[testName as keyof typeof availableTests](),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Test timeout')), timeout)
            )
          ]);
          results.results.push(testResult);
        } catch (error: any) {
          results.results.push({
            test: testName,
            status: 'failed',
            error: error.message,
          });
        }
      } else {
        results.results.push({
          test: testName,
          status: 'skipped',
          error: 'Test non disponible',
        });
      }
    }

    // Si aucun test spécifique demandé, exécuter un test de base
    if (tests.length === 0) {
      results.results.push(await availableTests.database_performance());
    }

    return NextResponse.json({
      success: true,
      data: results,
    });

  } catch (error: any) {
    console.error('Erreur POST /api/health:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// OPTIONS - Informations sur les tests disponibles
export async function OPTIONS() {
  return NextResponse.json({
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
  });
}