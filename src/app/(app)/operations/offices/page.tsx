"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlassCard, GlassButton, GlassInput, EmptyState, useToast } from "@/components/ui/glass";
import { Building, ArrowLeft, Search, MapPin, Users, DollarSign } from "lucide-react";

interface Office {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  capacity: number | null;
  currentOccupancy: number | null;
  managerName: string | null;
  monthlyCost: string | null;
  currency: string | null;
  createdAt: string;
}

export default function OfficesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [offices, setOffices] = useState<Office[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadOffices();
  }, []);

  const loadOffices = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/operations/offices");
      if (res.ok) {
        const data = await res.json();
        setOffices(data.offices || []);
      }
    } catch (error) {
      console.error("Error loading offices:", error);
      addToast("error", "Failed to load offices");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOffices = offices.filter(
    (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.city && o.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400";
      case "inactive":
        return "bg-gray-500/20 text-gray-400";
      case "closed":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-white/20 text-white/60";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "physical":
        return "Physical";
      case "virtual":
        return "Virtual";
      case "hybrid":
        return "Hybrid";
      default:
        return type;
    }
  };

  const formatCurrency = (amount: string | null, currency: string | null) => {
    if (!amount) return "-";
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(num);
  };

  const getOccupancyPercent = (current: number | null, capacity: number | null) => {
    if (!current || !capacity || capacity === 0) return 0;
    return Math.round((current / capacity) * 100);
  };

  return (
    <div className="min-h-screen p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <GlassButton onClick={() => router.push("/operations")} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </GlassButton>
          <div>
            <h1 className="text-3xl font-bold">Offices</h1>
            <p className="text-white/60">Manage office locations and resources</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
          <GlassInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, code, or city..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Offices List */}
      <GlassCard>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full mx-auto" />
            <p className="text-white/40 mt-4">Loading offices...</p>
          </div>
        ) : filteredOffices.length === 0 ? (
          <EmptyState
            icon={<Building className="w-6 h-6" />}
            title={searchQuery ? "No results found" : "No offices yet"}
            description={
              searchQuery
                ? "Try a different search term"
                : "Add your first office using the Record Activity button on the Operations page"
            }
          />
        ) : (
          <div className="divide-y divide-white/10">
            {filteredOffices.map((office) => (
              <div key={office.id} className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{office.name}</h3>
                      <span className="text-sm text-white/40 font-mono">{office.code}</span>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(office.status)}`}>
                        {office.status}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-white/10 text-white/60">
                        {getTypeLabel(office.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-white/60">
                      {(office.address || office.city) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {[office.city, office.state, office.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {office.managerName && (
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          Manager: {office.managerName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {office.monthlyCost && (
                      <div className="mb-2">
                        <p className="text-sm text-white/40">Monthly Cost</p>
                        <p className="text-lg font-semibold text-white flex items-center justify-end gap-1">
                          <DollarSign className="w-4 h-4" />
                          {formatCurrency(office.monthlyCost, office.currency)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Capacity Bar */}
                {office.capacity && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/60">Capacity</span>
                      <span className="text-sm text-white/60">
                        {office.currentOccupancy || 0} / {office.capacity} seats
                        ({getOccupancyPercent(office.currentOccupancy, office.capacity)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          getOccupancyPercent(office.currentOccupancy, office.capacity) > 90
                            ? "bg-red-500"
                            : getOccupancyPercent(office.currentOccupancy, office.capacity) > 70
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${getOccupancyPercent(office.currentOccupancy, office.capacity)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
