"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  GlassTable,
  GlassBadge,
  GlassInput,
  GlassSelect,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, formatDate } from "@/lib/http";

interface Customer {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

interface Partner {
  id: string;
  name: string;
  code: string;
  type: string;
  createdAt: string;
}

interface Salesperson {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CustomersResponse {
  items: Customer[];
  total: number;
}

interface PartnersResponse {
  items: Partner[];
  total: number;
}

interface SalespersonsResponse {
  items: Salesperson[];
  total: number;
}

type ViewType = "all" | "customers" | "partners" | "salespersons";

interface PeoplePartiesTabProps {
  initialView?: ViewType;
}

export function PeoplePartiesTab({ initialView = "all" }: PeoplePartiesTabProps) {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [viewType, setViewType] = React.useState<ViewType>(initialView);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [salespersons, setSalespersons] = React.useState<Salesperson[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Sync viewType with URL parameter or initialView prop
  React.useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam && ["all", "customers", "partners", "salespersons"].includes(viewParam)) {
      setViewType(viewParam as ViewType);
    } else if (initialView) {
      setViewType(initialView);
    }
  }, [searchParams, initialView]);

  React.useEffect(() => {
    loadData();
  }, [viewType]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (viewType === "customers" || viewType === "all") {
        const customersRes = await apiGet<CustomersResponse>("/api/sales-customers/customers");
        setCustomers(customersRes.items || []);
      } else {
        setCustomers([]);
      }

      if (viewType === "partners" || viewType === "all") {
        const partnersRes = await apiGet<PartnersResponse>("/api/master/parties?type=other");
        setPartners(partnersRes.items || []);
      } else {
        setPartners([]);
      }

      if (viewType === "salespersons" || viewType === "all") {
        const salespersonsRes = await apiGet<SalespersonsResponse>("/api/sales-customers/salespersons");
        setSalespersons(salespersonsRes.items || []);
      } else {
        setSalespersons([]);
      }
    } catch (error) {
      addToast("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = React.useMemo(() => {
    let filtered = customers;
    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [customers, searchQuery]);

  const filteredPartners = React.useMemo(() => {
    let filtered = partners;
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [partners, searchQuery]);

  const filteredSalespersons = React.useMemo(() => {
    let filtered = salespersons;
    if (searchQuery) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [salespersons, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <GlassInput
              placeholder="Search by name, code, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <GlassSelect
              value={viewType}
              onChange={(e) => setViewType(e.target.value as ViewType)}
              options={[
                { value: "all", label: "All" },
                { value: "customers", label: "Customers" },
                { value: "partners", label: "Partners" },
                { value: "salespersons", label: "Salespersons" },
              ]}
            />
          </div>
        </div>
      </GlassCard>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {(viewType === "customers" || viewType === "all") && filteredCustomers.length > 0 && (
            <GlassCard>
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">
                Customers
              </h3>
              <GlassTable
                headers={["Code", "Name", "Email", "Phone", "Created"]}
                rows={filteredCustomers.map((c) => [
                  c.code,
                  c.name,
                  c.email || "-",
                  c.phone || "-",
                  formatDate(c.createdAt),
                ])}
              />
            </GlassCard>
          )}

          {(viewType === "partners" || viewType === "all") && filteredPartners.length > 0 && (
            <GlassCard>
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">
                Partners
              </h3>
              <GlassTable
                headers={["Code", "Name", "Type", "Created"]}
                rows={filteredPartners.map((p) => [
                  p.code,
                  p.name,
                  p.type,
                  formatDate(p.createdAt),
                ])}
              />
            </GlassCard>
          )}

          {(viewType === "salespersons" || viewType === "all") && filteredSalespersons.length > 0 && (
            <GlassCard>
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">
                Salespersons
              </h3>
              <GlassTable
                headers={["Name", "Email", "Phone", "Status", "Created"]}
                rows={filteredSalespersons.map((s) => [
                  s.name,
                  s.email || "-",
                  s.phone || "-",
                  <GlassBadge key={s.id} variant={s.isActive ? "success" : "default"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </GlassBadge>,
                  formatDate(s.createdAt),
                ])}
              />
            </GlassCard>
          )}

          {filteredCustomers.length === 0 && filteredPartners.length === 0 && filteredSalespersons.length === 0 && (
            <GlassCard>
              <div className="text-center py-12">
                <p className="text-white/50">No items found</p>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
