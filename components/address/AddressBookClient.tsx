"use client";

import { useRef, useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Gift, Loader2, MapPin, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { AddressForm, type AddressFieldName } from "@/components/address/AddressForm";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { addressSchema, type AddressFormInput, type AddressValues } from "@/lib/account/validation";
import type { SavedAddressRecord } from "@/lib/account/types";
import type { FieldPath } from "react-hook-form";

const addressFieldNames: Record<AddressFieldName, FieldPath<AddressFormInput>> = {
  first_name: "first_name",
  last_name: "last_name",
  street_address: "street_address",
  apartment: "apt_suite_unit",
  city: "city",
  state: "state",
  phone: "phone",
  postal_code: "postal_code",
  delivery_instructions: "delivery_instructions",
};

function getAddressFormValues(address?: SavedAddressRecord | null): AddressFormInput {
  return {
    label: address?.label || "",
    first_name: address?.first_name || "",
    last_name: address?.last_name || "",
    phone: address?.phone || "",
    street_address: address?.street_address || "",
    apt_suite_unit: address?.apt_suite_unit || "",
    city: address?.city || "",
    state: address?.state || "",
    postal_code: address?.postal_code || "",
    delivery_instructions: address?.delivery_instructions || "",
    is_default: address?.is_default || false,
    is_default_billing: address?.is_default_billing || false,
  };
}

function formatAddress(address: SavedAddressRecord) {
  return [
    address.street_address,
    address.apt_suite_unit,
    `${address.city}, ${address.state}${address.postal_code ? ` ${address.postal_code}` : ""}`,
  ].filter(Boolean);
}

function formatPhone(phone: string | null) {
  return phone || "No phone number";
}

export function AddressBookClient({ initialAddresses }: { initialAddresses: SavedAddressRecord[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddressRecord | null>(null);
  const [fullNameValue, setFullNameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedAddressRecord | null>(null);
  const newAddressId = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const form = useForm<AddressFormInput, unknown, AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: getAddressFormValues(),
  });

  const { contextSafe } = useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      if (newAddressId.current) {
        const card = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-address-card]") ?? [])
          .find((element) => element.dataset.addressId === newAddressId.current);
        if (card) gsap.from(card, { autoAlpha: 0, y: -20, duration: 0.4, ease: "back.out(1.5)" });
        newAddressId.current = null;
        return;
      }
      gsap.from("[data-address-card]", { autoAlpha: 0, y: 20, stagger: 0.08, duration: 0.3 });
    });
    return () => media.revert();
  }, { scope: listRef, dependencies: [addresses], revertOnUpdate: true });

  const openAddSheet = () => {
    setEditingAddress(null);
    setFullNameValue("");
    form.reset(getAddressFormValues());
    setSheetOpen(true);
  };

  const openEditSheet = (address: SavedAddressRecord) => {
    setEditingAddress(address);
    setFullNameValue(`${address.first_name} ${address.last_name}`.trim());
    form.reset(getAddressFormValues(address));
    setSheetOpen(true);
  };

  const onSave = async (values: AddressValues) => {
    const isEditing = Boolean(editingAddress);
    const endpoint = editingAddress ? `/api/account/addresses/${editingAddress.id}` : "/api/account/addresses";
    try {
      const response = await fetch(endpoint, {
        method: editingAddress ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json() as { address?: SavedAddressRecord; error?: string };
      if (!response.ok || !data.address) throw new Error(data.error || "Couldn't save this address. Please try again.");

      const saved = data.address;
      const isFirstAddress = !isEditing && addresses.length === 0;
      setAddresses((current) => {
        const updated = current
          .filter((item) => item.id !== saved.id)
          .map((item) => ({
            ...item,
            is_default: values.is_default ? false : item.is_default,
            is_default_billing: values.is_default_billing ? false : item.is_default_billing,
          }));
        return [saved, ...updated].sort((a, b) => Number(b.is_default) - Number(a.is_default) || b.created_at.localeCompare(a.created_at));
      });
      if (!isEditing) newAddressId.current = saved.id;
      trackEvent(isEditing ? "address.edited" : "address.added", isEditing ? {} : { is_first: isFirstAddress });
      if (values.is_default) trackEvent("address.set_default");
      toast({ title: isEditing ? "Address updated." : "Address saved.", variant: "success" });
      setSheetOpen(false);
    } catch {
      toast({ title: "Couldn't save this address. Please try again.", variant: "danger" });
    }
  };

  const animateDelete = contextSafe((card: HTMLElement | undefined, finish: () => void) => {
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    gsap.to(card, { autoAlpha: 0, y: -10, duration: 0.3, onComplete: finish });
  });

  const removeAddress = async () => {
    const address = deleteTarget;
    if (!address) return;
    if (deletingId) return;
    setDeletingId(address.id);
    try {
      const response = await fetch(`/api/account/addresses/${address.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string; deleted?: boolean };
      if (!response.ok || !data.deleted) throw new Error(data.error || "Couldn't delete this address. Please try again.");

      const card = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-address-card]") ?? [])
        .find((element) => element.dataset.addressId === address.id);
      animateDelete(card, () => {
        setAddresses((current) => current.filter((item) => item.id !== address.id));
      });
      trackEvent("address.deleted", { was_default: address.is_default });
      toast({ title: "Address removed", variant: "success" });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Couldn't delete this address. Please try again.", variant: "danger" });
    } finally {
      setDeletingId(null);
    }
  };

  const setDefault = async (address: SavedAddressRecord) => {
    try {
      const response = await fetch(`/api/account/addresses/${address.id}/set-default`, {
        method: "PATCH",
      });
      const data = await response.json() as { updated?: boolean; error?: string };
      if (!response.ok || !data.updated) throw new Error(data.error || "Couldn't set as default. Please try again.");
      setAddresses((current) => current.map((item) => ({ ...item, is_default: item.id === address.id })));
      trackEvent("address.set_default");
      toast({ title: "Default address updated.", variant: "success" });
    } catch {
      toast({ title: "Couldn't set as default. Please try again.", variant: "danger" });
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSave)(event);
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Saved addresses</h1>
          <p className="mt-2 text-sm text-muted">Manage your saved delivery details.</p>
        </div>
        <Button size="sm" onClick={openAddSheet}><Plus aria-hidden="true" className="h-4 w-4" />Add address</Button>
      </header>

      {addresses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-card px-4 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-light">
            <span className="relative flex h-12 w-12 items-center justify-center">
              <Gift aria-hidden="true" className="absolute left-0 top-0 h-8 w-8 text-brand" strokeWidth={1.5} />
              <MapPin aria-hidden="true" className="absolute bottom-0 right-0 h-7 w-7 text-muted" strokeWidth={1.5} />
            </span>
          </div>
          <h2 className="mt-5 text-lg font-semibold text-ink">No saved addresses yet</h2>
          <p className="mt-2 text-sm text-muted">Add one for faster checkout.</p>
          <Button className="mt-5" size="sm" onClick={openAddSheet}>Add your first address</Button>
        </div>
      ) : (
        <div ref={listRef} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <article key={address.id} data-address-card data-address-id={address.id} className="rounded-2xl border border-line bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {address.label ? <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">{address.label}</span> : null}
                    {address.is_default && <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand">Default</span>}
                  </div>
                  <h2 className="mt-3 text-sm font-semibold text-ink">
                    {[address.first_name, address.last_name].filter(Boolean).join(" ")}
                  </h2>
                  <div className="mt-1 text-sm leading-6 text-muted">
                    {formatAddress(address).map((line) => <p key={line}>{line}</p>)}
                  </div>
                  <p className="mt-1 text-sm text-muted">{formatPhone(address.phone)}</p>
                </div>
                <div className="relative shrink-0">
                  <details className="group">
                    <summary aria-label={`Actions for ${address.label || "saved"} address`} className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                      <MoreVertical aria-hidden="true" className="h-5 w-5" />
                    </summary>
                    <div className="absolute right-0 top-11 z-10 min-w-44 rounded-xl border border-line bg-card p-1 shadow-lg">
                      <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); openEditSheet(address); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-ink hover:bg-surface">
                        <Pencil aria-hidden="true" className="h-4 w-4" />Edit
                      </button>
                      {!address.is_default && (
                        <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void setDefault(address); }} className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-ink hover:bg-surface">
                          Set as default
                        </button>
                      )}
                      <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setDeleteTarget(address); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-danger hover:bg-brand-light">
                        <Trash2 aria-hidden="true" className="h-4 w-4" />Delete
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="max-h-[90dvh] overflow-y-auto md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:max-w-[560px] md:rounded-2xl">
          <SheetHeader>
            <SheetTitle>{editingAddress ? "Edit address" : "Add new address"}</SheetTitle>
            <SheetDescription>Save a Nigerian delivery address to use again at checkout.</SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={handleFormSubmit} className="mt-6 space-y-5">
              <FormField control={form.control} name="label" render={({ field }) => (
                <FormItem><FormLabel>Label (optional)</FormLabel><Input placeholder="e.g. Home, Work, Mum's house" maxLength={50} {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="first_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <Input
                    autoComplete="name"
                    placeholder="Jane Doe"
                    required
                    value={fullNameValue}
                    onChange={(event) => {
                      const fullName = event.currentTarget.value;
                      const normalized = fullName.trimStart();
                      const splitIndex = normalized.search(/\s/);
                      const firstName = splitIndex < 0 ? normalized : normalized.slice(0, splitIndex);
                      const lastName = splitIndex < 0 ? "" : normalized.slice(splitIndex).trimStart();
                      setFullNameValue(fullName);
                      field.onChange(firstName);
                      form.setValue("last_name", lastName, { shouldDirty: true, shouldValidate: true });
                    }}
                    maxLength={100}
                  />
                  <FormMessage />
                  {form.formState.errors.last_name?.message ? (
                    <p className="text-xs text-brand">{form.formState.errors.last_name.message}</p>
                  ) : null}
                </FormItem>
              )} />
              <AddressForm
                control={form.control}
                fieldName={(field) => addressFieldNames[field]}
                phoneRequired
                showNameFields={false}
                addressLine1Label="Address line 1"
                addressLine2Label="Address line 2"
              />
              <div className="space-y-3 rounded-xl bg-surface p-4">
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input type="checkbox" className="mt-1 accent-brand" {...form.register("is_default")} />
                  <span>Set as default</span>
                </label>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="ghost" fullWidth onClick={() => setSheetOpen(false)} disabled={form.formState.isSubmitting}>Cancel</Button>
                <Button type="submit" fullWidth disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save address"}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete address?</DialogTitle>
            <DialogDescription>Are you sure you want to delete this address? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingId)}>Cancel</Button>
            <button type="button" onClick={() => void removeAddress()} disabled={Boolean(deletingId)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-danger px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50">
              {deletingId ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting…</> : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
