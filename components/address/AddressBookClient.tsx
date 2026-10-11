"use client";

import { useRef, useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { AddressForm, type AddressFieldName } from "@/components/address/AddressForm";
import { Button } from "@/components/ui/Button";
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
    label: address?.label || "Home",
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    form.reset(getAddressFormValues());
    setSheetOpen(true);
  };

  const openEditSheet = (address: SavedAddressRecord) => {
    setEditingAddress(address);
    form.reset(getAddressFormValues(address));
    setSheetOpen(true);
  };

  const onSave = async (values: AddressValues) => {
    const isEditing = Boolean(editingAddress);
    const endpoint = editingAddress ? `/api/addresses/${editingAddress.id}` : "/api/addresses";
    try {
      const response = await fetch(endpoint, {
        method: editingAddress ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json() as { address?: SavedAddressRecord; error?: string };
      if (!response.ok || !data.address) throw new Error(data.error || "Couldn't save address. Try again.");

      const saved = data.address;
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
      trackEvent(isEditing ? "account.address.edited" : "account.address.added", isEditing ? {} : { is_default: values.is_default });
      if (values.is_default || values.is_default_billing) trackEvent("account.address.set_default");
      toast({ title: isEditing ? "Address updated." : "Address saved.", variant: "success" });
      setSheetOpen(false);
    } catch {
      toast({ title: "Couldn't save address. Try again.", variant: "danger" });
    }
  };

  const animateDelete = contextSafe((card: HTMLElement | undefined, finish: () => void) => {
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    gsap.to(card, { autoAlpha: 0, y: -10, duration: 0.3, onComplete: finish });
  });

  const removeAddress = async (address: SavedAddressRecord) => {
    if (deletingId) return;
    setDeletingId(address.id);
    try {
      const response = await fetch(`/api/addresses/${address.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string; addresses?: SavedAddressRecord[] };
      if (!response.ok) throw new Error(data.error || "Couldn't remove address. Try again.");

      const card = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-address-card]") ?? [])
        .find((element) => element.dataset.addressId === address.id);
      animateDelete(card, () => {
        setAddresses(data.addresses ?? []);
      });
      trackEvent("account.address.deleted", { was_default: address.is_default || address.is_default_billing });
      toast({ title: "Address removed", variant: "success" });
    } catch {
      toast({ title: "Couldn't remove address. Try again.", variant: "danger" });
    } finally {
      setDeletingId(null);
    }
  };

  const setDefault = async (address: SavedAddressRecord) => {
    try {
      const response = await fetch(`/api/addresses/${address.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      const data = await response.json() as { address?: SavedAddressRecord; error?: string };
      if (!response.ok || !data.address) throw new Error(data.error || "Couldn't update address. Try again.");
      setAddresses((current) => current.map((item) => ({ ...item, is_default: item.id === address.id })));
      trackEvent("account.address.set_default");
      toast({ title: "Default address updated.", variant: "success" });
    } catch {
      toast({ title: "Couldn't update address. Try again.", variant: "danger" });
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSave)(event);
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Addresses</h1>
          <p className="mt-2 text-sm text-muted">Manage your saved delivery details.</p>
        </div>
        <Button variant="ghost" onClick={openAddSheet}><Plus aria-hidden="true" className="h-4 w-4" />Add new address</Button>
      </header>

      {addresses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-stone-100 bg-white px-4 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-light">
            <MapPin aria-hidden="true" className="h-10 w-10 text-muted" strokeWidth={1.5} />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-ink">No saved addresses yet</h2>
          <p className="mt-2 text-sm text-muted">Add one for faster checkout.</p>
          <Button className="mt-5" onClick={openAddSheet}>Add address</Button>
        </div>
      ) : (
        <div ref={listRef} className="mt-8 space-y-4">
          {addresses.map((address) => (
            <article key={address.id} data-address-card data-address-id={address.id} className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">{address.label}</span>
                    {address.is_default && <span className="rounded-full bg-brand text-white px-3 py-1 text-xs font-semibold">Default</span>}
                    {!address.is_default && address.is_default_billing && <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand">Default billing</span>}
                  </div>
                  <h2 className="mt-3 text-sm font-semibold text-ink">{address.first_name} {address.last_name}</h2>
                  <div className="mt-1 text-sm leading-6 text-muted">
                    {formatAddress(address).map((line) => <p key={line}>{line}</p>)}
                  </div>
                  <p className="mt-1 text-sm text-muted">{formatPhone(address.phone)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Edit ${address.label} address`} onClick={() => openEditSheet(address)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
                    <Pencil aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={`Delete ${address.label} address`} disabled={deletingId === address.id} onClick={() => void removeAddress(address)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50">
                    {deletingId === address.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {!address.is_default && (
                <button type="button" onClick={() => void setDefault(address)} className="mt-3 min-h-11 text-sm font-medium text-muted underline-offset-4 hover:text-brand hover:underline">Set as default</button>
              )}
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
                <FormItem><FormLabel>Label</FormLabel><Input placeholder="e.g. Home, Office, Mum's place" maxLength={50} {...field} value={field.value ?? ""} /><FormMessage /></FormItem>
              )} />
              <AddressForm control={form.control} fieldName={(field) => addressFieldNames[field]} />
              <div className="space-y-3 rounded-xl bg-surface p-4">
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input type="checkbox" className="mt-1 accent-brand" {...form.register("is_default")} />
                  <span>Set as default shipping address</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input type="checkbox" className="mt-1 accent-brand" {...form.register("is_default_billing")} />
                  <span>Set as default billing address</span>
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
    </div>
  );
}
