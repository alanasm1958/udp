"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlassCard, GlassButton, GlassInput, EmptyState, useToast } from "@/components/ui/glass";
import { Briefcase, ArrowLeft, Search, Mail, Phone, Star, DollarSign } from "lucide-react";

interface Contractor {
  id: string;
  fullName: string;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  employmentType: string;
  jobTitle: string | null;
  department: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export default function ContractorsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadContractors();
  }, []);

  const loadContractors = async () => {
    try {
      setIsLoading(true);
      // Contractors are stored in hr_persons with employmentType = 'contractor'
      const res = await fetch("/api/hr-people/persons?employmentType=contractor");
      if (res.ok) {
        const data = await res.json();
        setContractors(data.persons || []);
      }
    } catch (error) {
      console.error("Error loading contractors:", error);
      addToast("error", "Failed to load contractors");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContractors = contractors.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.jobTitle && c.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400";
      case "on_leave":
        return "bg-yellow-500/20 text-yellow-400";
      case "terminated":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-white/20 text-white/60";
    }
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
            <h1 className="text-3xl font-bold">Contractors</h1>
            <p className="text-white/60">Manage contractor relationships and freelancers</p>
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
            placeholder="Search by name, email, or job title..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Contractors List */}
      <GlassCard>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full mx-auto" />
            <p className="text-white/40 mt-4">Loading contractors...</p>
          </div>
        ) : filteredContractors.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="w-6 h-6" />}
            title={searchQuery ? "No results found" : "No contractors yet"}
            description={
              searchQuery
                ? "Try a different search term"
                : "Add contractors through the HR & People section or the Record Activity button"
            }
          />
        ) : (
          <div className="divide-y divide-white/10">
            {filteredContractors.map((contractor) => (
              <div key={contractor.id} className="p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center text-lg font-semibold text-pink-400">
                      {contractor.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {contractor.fullName}
                          {contractor.preferredName && (
                            <span className="text-white/40 text-sm ml-2">
                              ({contractor.preferredName})
                            </span>
                          )}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(contractor.status)}`}>
                          {contractor.status.replace("_", " ")}
                        </span>
                      </div>
                      {contractor.jobTitle && (
                        <p className="text-sm text-white/60 mb-2">
                          {contractor.jobTitle}
                          {contractor.department && ` • ${contractor.department}`}
                        </p>
                      )}
                      <div className="flex items-center gap-6 text-sm text-white/40">
                        {contractor.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {contractor.email}
                          </span>
                        )}
                        {contractor.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {contractor.phone}
                          </span>
                        )}
                      </div>
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
