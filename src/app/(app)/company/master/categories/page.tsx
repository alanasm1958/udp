"use client";

import * as React from "react";
import { GlassCard, PageHeader, Spinner, GlassButton, SlideOver, GlassInput, GlassTextarea, GlassSelect, GlassTabs, GlassBadge, EmptyState, useToast } from "@/components/ui/glass";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/http";

type CategoryDomain = "product" | "party" | "service" | "generic";

interface Category {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  domain: CategoryDomain;
  parentCategoryId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
}

const domainTabs = [
  { id: "all", label: "All" },
  { id: "product", label: "Products" },
  { id: "party", label: "Parties" },
  { id: "service", label: "Services" },
  { id: "generic", label: "Generic" },
];

const domainColors: Record<CategoryDomain, string> = {
  product: "bg-purple-500/20 text-purple-400",
  party: "bg-blue-500/20 text-blue-400",
  service: "bg-amber-500/20 text-amber-400",
  generic: "bg-gray-500/20 text-gray-400",
};

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = React.useState("all");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [slideOver, setSlideOver] = React.useState<{ open: boolean; mode: "create" | "edit"; category?: Category }>({ open: false, mode: "create" });
  const [form, setForm] = React.useState({
    name: "",
    code: "",
    description: "",
    domain: "product" as CategoryDomain,
    parentCategoryId: "",
  });
  const { addToast } = useToast();

  // Load categories
  React.useEffect(() => {
    async function loadCategories() {
      try {
        const result = await apiGet<{ items: Category[] }>("/api/master/categories");
        setCategories(result.items);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      addToast("error", "Category name is required");
      return;
    }

    try {
      setSaving(true);
      const result = await apiPost<{ success: boolean; category: Category }>("/api/master/categories", {
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        domain: form.domain,
        parentCategoryId: form.parentCategoryId || null,
      });
      if (result.success) {
        setCategories((prev) => [...prev, result.category]);
        setSlideOver({ open: false, mode: "create" });
        setForm({ name: "", code: "", description: "", domain: "product", parentCategoryId: "" });
        addToast("success", "Category created");
      }
    } catch {
      addToast("error", "Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!slideOver.category || !form.name.trim()) {
      addToast("error", "Category name is required");
      return;
    }

    try {
      setSaving(true);
      const result = await apiPatch<{ success: boolean; category: Category }>(
        `/api/master/categories/${slideOver.category.id}`,
        {
          name: form.name.trim(),
          code: form.code.trim() || null,
          description: form.description.trim() || null,
          parentCategoryId: form.parentCategoryId || null,
        }
      );
      if (result.success) {
        setCategories((prev) => prev.map((c) => (c.id === result.category.id ? result.category : c)));
        setSlideOver({ open: false, mode: "create" });
        setForm({ name: "", code: "", description: "", domain: "product", parentCategoryId: "" });
        addToast("success", "Category updated");
      }
    } catch {
      addToast("error", "Failed to update category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      await apiDelete(`/api/master/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      addToast("success", "Category deleted");
    } catch (error: unknown) {
      const err = error as { message?: string };
      addToast("error", err?.message || "Failed to delete category");
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const result = await apiPatch<{ success: boolean; category: Category }>(
        `/api/master/categories/${category.id}`,
        { isActive: !category.isActive }
      );
      if (result.success) {
        setCategories((prev) => prev.map((c) => (c.id === category.id ? result.category : c)));
        addToast("success", `Category ${result.category.isActive ? "activated" : "deactivated"}`);
      }
    } catch {
      addToast("error", "Failed to update category");
    }
  };

  const filteredCategories = activeTab === "all"
    ? categories
    : categories.filter((c) => c.domain === activeTab);

  const parentOptions = categories
    .filter((c) =>
      (slideOver.mode === "create" ? c.domain === form.domain : c.domain === slideOver.category?.domain) &&
      c.id !== slideOver.category?.id
    )
    .map((c) => ({ value: c.id, label: c.name }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Classify products, parties, and services"
        actions={
          <GlassButton
            variant="primary"
            onClick={() => {
              setForm({ name: "", code: "", description: "", domain: "product", parentCategoryId: "" });
              setSlideOver({ open: true, mode: "create" });
            }}
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Category
          </GlassButton>
        }
      />

      <GlassTabs tabs={domainTabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <GlassCard>
        {filteredCategories.length === 0 ? (
          <EmptyState
            title="No categories"
            description={activeTab === "all" ? "Create categories to classify your data." : `No ${activeTab} categories found.`}
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
            }
          />
        ) : (
          <div className="space-y-2">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className={`flex items-center justify-between p-3 rounded-xl transition-colors group ${
                  category.isActive ? "bg-white/5 hover:bg-white/8" : "bg-white/2 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${domainColors[category.domain]} flex items-center justify-center`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{category.name}</p>
                      {category.code && (
                        <span className="text-xs text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
                          {category.code}
                        </span>
                      )}
                      <GlassBadge variant="default">
                        {category.domain}
                      </GlassBadge>
                      {!category.isActive && (
                        <GlassBadge variant="warning">
                          inactive
                        </GlassBadge>
                      )}
                    </div>
                    <p className="text-xs text-white/40">
                      {category.description || "No description"}
                      {category.parentCategoryId && (
                        <span className="ml-2">
                          (Parent: {categories.find((c) => c.id === category.parentCategoryId)?.name || "Unknown"})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggleActive(category)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      category.isActive
                        ? "text-white/40 hover:text-amber-400 hover:bg-amber-500/10"
                        : "text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10"
                    }`}
                    title={category.isActive ? "Deactivate" : "Activate"}
                  >
                    {category.isActive ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setForm({
                        name: category.name,
                        code: category.code || "",
                        description: category.description || "",
                        domain: category.domain,
                        parentCategoryId: category.parentCategoryId || "",
                      });
                      setSlideOver({ open: true, mode: "edit", category });
                    }}
                    className="p-1.5 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Category SlideOver */}
      <SlideOver
        open={slideOver.open}
        onClose={() => setSlideOver({ open: false, mode: "create" })}
        title={slideOver.mode === "create" ? "Create Category" : "Edit Category"}
      >
        <div className="space-y-4">
          <GlassInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Category name"
            required
          />
          <GlassInput
            label="Code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="Short code (optional)"
          />
          <GlassTextarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Category description..."
            rows={2}
          />
          {slideOver.mode === "create" && (
            <GlassSelect
              label="Domain"
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value as CategoryDomain, parentCategoryId: "" }))}
              options={[
                { value: "product", label: "Product" },
                { value: "party", label: "Party" },
                { value: "service", label: "Service" },
                { value: "generic", label: "Generic" },
              ]}
            />
          )}
          <GlassSelect
            label="Parent Category"
            value={form.parentCategoryId}
            onChange={(e) => setForm((f) => ({ ...f, parentCategoryId: e.target.value }))}
            options={[
              { value: "", label: "None (top-level)" },
              ...parentOptions,
            ]}
          />
          <div className="flex gap-2 pt-4">
            <GlassButton
              variant="primary"
              className="flex-1"
              disabled={saving}
              onClick={slideOver.mode === "create" ? handleCreate : handleUpdate}
            >
              {saving ? "Saving..." : slideOver.mode === "create" ? "Create" : "Save Changes"}
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => setSlideOver({ open: false, mode: "create" })}>
              Cancel
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
