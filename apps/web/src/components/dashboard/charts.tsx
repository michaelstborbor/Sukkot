"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point {
  month: string;
  enquiries: number;
  views: number;
  incomeSLE: number;
}

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });

function Empty({ text }: { text: string }) {
  return <div className="flex h-56 items-center justify-center rounded-xl bg-canvas text-sm text-muted">{text}</div>;
}

export function ActivityChart({ data }: { data: Point[] }) {
  const hasData = data.some((d) => d.views || d.enquiries);
  if (!hasData) return <Empty text="Views and enquiries will appear here once your listings are live." />;
  return (
    <div className="h-64" role="img" aria-label="Monthly listing views and enquiries for the last six months">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((d) => ({ ...d, label: monthLabel(d.month) }))} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#e3e6ec" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis yAxisId="v" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
          <YAxis yAxisId="e" orientation="right" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e3e6ec" }} />
          <Line yAxisId="v" type="monotone" dataKey="views" name="Views" stroke="#0B1F3A" strokeWidth={2.5} dot={false} />
          <Line yAxisId="e" type="monotone" dataKey="enquiries" name="Enquiries" stroke="#0F766E" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IncomeChart({ data }: { data: Point[] }) {
  if (!data.some((d) => d.incomeSLE)) return <Empty text="Recorded rent and payments in Leones will be summarised here." />;
  return (
    <div className="h-64" role="img" aria-label="Recorded income in Leones by month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, label: monthLabel(d.month) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e3e6ec" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v: number) => `Le ${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
          <Tooltip formatter={(v: number) => [`Le ${v.toLocaleString("en")}`, "Recorded income"]} contentStyle={{ borderRadius: 12, border: "1px solid #e3e6ec" }} />
          <Bar dataKey="incomeSLE" fill="#C8962E" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
