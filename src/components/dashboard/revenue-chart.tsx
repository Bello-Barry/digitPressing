'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Calendar } from 'lucide-react';

interface RevenueDataPoint {
  label: string;
  value: number;
  transactions?: number;
}

interface RevenueChartProps {
  data?: RevenueDataPoint[];
  isLoading?: boolean;
  period?: '7d' | '30d' | '90d';
  onPeriodChange?: (period: '7d' | '30d' | '90d') => void;
  className?: string;
}

const generateMockData = (days: number): RevenueDataPoint[] => {
  const points: RevenueDataPoint[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    const baseRevenue = 2000 + Math.random() * 3000;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const revenue = isWeekend ? baseRevenue * 0.7 : baseRevenue;
    
    points.push({
      label: date.toLocaleDateString('fr-FR', {
        month: 'short', 
        day: 'numeric' 
      }),
      value: Math.round(revenue),
      transactions: Math.round(revenue / 45 + Math.random() * 10),
    });
  }
  
  return points;
};

const periodOptions: Record<'7d' | '30d' | '90d', { label: string; days: number }> = {
  '7d': { label: '7 jours', days: 7 },
  '30d': { label: '30 jours', days: 30 },
  '90d': { label: '90 jours', days: 90 },
};

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  isLoading = false,
  period = '7d',
  onPeriodChange
}) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>(period);
  
  const chartData = data || generateMockData(periodOptions[selectedPeriod].days);

  const handlePeriodChange = (newPeriod: '7d' | '30d' | '90d') => {
    setSelectedPeriod(newPeriod);
    if (onPeriodChange) {
      onPeriodChange(newPeriod);
    }
  };

  const totalRevenue = chartData.reduce((sum, item) => sum + item.value, 0);
  const totalTransactions = chartData.reduce((sum, item) => sum + (item.transactions || 0), 0);
  const averageRevenue = chartData.length > 0 ? totalRevenue / chartData.length : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Évolution des revenus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Chargement du graphique...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Évolution des revenus
          </CardTitle>
          <div className="flex gap-2">
            <Select 
              value={selectedPeriod} 
              onValueChange={(val) => handlePeriodChange(val as '7d' | '30d' | '90d')}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodOptions).map(([key, option]) => (
                  <SelectItem key={key} value={key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={chartType} 
              onValueChange={(value: 'line' | 'bar') => setChartType(value)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Ligne</SelectItem>
                <SelectItem value="bar">Barres</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Statistiques rapides */}
        <div className="flex gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded-full" />
            <span className="text-muted-foreground">Total:</span>
            <span className="font-semibold">{formatCurrency(totalRevenue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Moyenne:</span>
            <span className="font-semibold">{formatCurrency(averageRevenue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Transactions:</span>
            <span className="font-semibold">{totalTransactions}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(value) => `${Math.round(value / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: any) => [
                  formatCurrency(Number(value) || 0),
                  'Revenus'
                ]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                name="Revenus"
              />
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(value) => `${Math.round(value / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: any) => [
                  formatCurrency(Number(value) || 0),
                  'Revenus'
                ]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              <Bar
                dataKey="value"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="Revenus"
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};