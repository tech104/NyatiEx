import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const generateChartData = (days: number) => {
  const data = [];
  let value = 42500;
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    value = value + (Math.random() - 0.48) * 1000;
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.max(value, 30000),
    });
  }
  return data;
};

const timeframes = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

export function PriceChart() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("1M");
  const data = generateChartData(selectedTimeframe === "1D" ? 1 : selectedTimeframe === "1W" ? 7 : selectedTimeframe === "1M" ? 30 : selectedTimeframe === "3M" ? 90 : 365);

  return (
    <Card className="bg-card border-border card-hover">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-display">Portfolio Value</CardTitle>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {timeframes.map((tf) => (
            <Button
              key={tf}
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 text-xs font-medium",
                selectedTimeframe === tf && "bg-background text-foreground shadow-sm"
              )}
              onClick={() => setSelectedTimeframe(tf)}
            >
              {tf}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(158 64% 52%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(158 64% 52%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                stroke="hsl(220 15% 55%)" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(220 15% 55%)" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(225 25% 9%)', 
                  border: '1px solid hsl(225 20% 18%)',
                  borderRadius: '8px',
                  color: 'hsl(210 20% 95%)'
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(158 64% 52%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
