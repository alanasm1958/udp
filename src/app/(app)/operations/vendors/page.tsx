"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlassCard, GlassButton, GlassInput, GlassBadge, PageHeader, Spinner, EmptyState, useToast } from "@/components/ui/glass";
import { Users, Mail, Phone, Star, Building } from "lucide-react";

interface Vendor {
  id: string;
  code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  taxId: string | null;
  defaultCurrency: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export default function VendorsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/master/parties?type=vendor");
      if (res.ok) {
        const data = await res.json();
        // Map API response fields to expected format
        setVendors((data.items || []).map((p: { id: string; displayName: string; code: string | null; createdAt: string }) => ({
          id: p.id,
          code: p.code,
          name: p.displayName,
          email: null,
          phone: null,
          address: null,
          city: null,
          state: null,
          country: null,
          taxId: null,
          defaultCurrency: null,
          notes: null,
          metadata: null,
          createdAt: p.createdAt,
        })));
      }
    } catch (error) {
      console.error("Error loading vendors:", error);
      addToast("error", "Failed to load vendors");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.code && v.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.email && v.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getVendorType = (vendor: Vendor) => {
    const metadata = vendor.metadata as { vendorType?: string } | null;
    return metadata?.vendorType || "supplier";
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "supplier":
        return "Supplier";
      case "service_provider":
        return "Service Provider";
      case "both":
        return "Supplier & Service";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Manage vendor relationships and suppliers"
      />

      {/* Search */}
      <GlassCard padding="sm">
        <div className="flex gap-4 items-center">
          <div className="flex-1 max-w-md">
            <GlassInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, code, or email..."
            />
          </div>
          <span className="text-sm text-white/40">{filteredVendors.length} vendors</span>
        </div>
      </GlassCard>

      {/* Vendors List */}
      <GlassCard padding="none">
        {isLoading ? (
          <div className="p-8 text-center">
            <Spinner size="md" />
            <p className="text-white/40 text-sm mt-4">Loading vendors...</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title={searchQuery ? "No results found" : "No vendors yet"}
            description={
              searchQuery
                ? "Try a different search term"
                : "Add your first vendor using the Record Activity button on the Operations page"
            }
          />
        ) : (
          <div className="divide-y divide-white/10">
            {filteredVendors.map((vendor) => (
              <div key={vendor.id} className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-lg font-semibold text-cyan-400">
                      {vendor.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{vendor.name}</h3>
                        {vendor.code && (
                          <span className="text-sm text-white/40 font-mono">{vendor.code}</span>
                        )}
                        <GlassBadge variant="info">
                          {getTypeLabel(getVendorType(vendor))}
                        </GlassBadge>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-white/60">
                        {vendor.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {vendor.email}
                          </span>
                        )}
                        {vendor.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {vendor.phone}
                          </span>
                        )}
                      </div>
                      {vendor.city && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-white/40">
                          <Building className="w-4 h-4" />
                          {[vendor.city, vendor.state, vendor.country].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Star className="w-4 h-4 fill-yellow-400" />
                      <Star className="w-4 h-4 fill-yellow-400" />
                      <Star className="w-4 h-4 fill-yellow-400" />
                      <Star className="w-4 h-4 text-white/20" />
                      <Star className="w-4 h-4 text-white/20" />
                    </div>
                    <p className="text-xs text-white/40 mt-1">Rating</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
