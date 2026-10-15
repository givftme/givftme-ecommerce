"use client";

import { Fragment, useState } from "react";
import { ArrowRight, Loader2, Pencil, UserPlus } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Avatar, Card, Field, Modal, Select, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateTeamMember } from "@/lib/business-dashboard/actions";
import { APPROVAL_FLOW, BUSINESS_ROLE_LABELS, BUSINESS_ROLES, type BusinessRole } from "@/lib/business-dashboard/data";
import type { BusinessMember } from "@/lib/business-dashboard/types";

const ROLE_HELP: Record<BusinessRole, string> = {
  admin: "Everything, including the team and reminder settings",
  editor: "People, campaigns and the brand kit",
  approver: "Approves campaigns and sees the budget",
  limited: "Sees their own campaigns only",
};

/** Team list, invites, and the approval flow. */
export function BizTeam() {
  const { team, member, can, toast } = useBizDash();
  const [editing, setEditing] = useState<BusinessMember | null>(null);
  const manage = can("manage_team");

  return (
    <>
      <ViewHeader
        title="Team & approvals"
        description="Who can plan, who approves, and how a campaign gets from idea to doorstep."
        actions={
          manage ? (
            <Button size="sm" onClick={() => toast("Invite sent")}>
              <UserPlus aria-hidden="true" className="h-4 w-4" /> Invite colleague
            </Button>
          ) : null
        }
      />

      <Card title="Approval flow" className="mb-4 md:mb-6">
        <ol className="flex flex-wrap items-center gap-2">
          {APPROVAL_FLOW.map((step, index) => (
            <Fragment key={step}>
              <li className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink">{step}</li>
              {index < APPROVAL_FLOW.length - 1 ? (
                <li aria-hidden="true" className="text-muted">
                  <ArrowRight className="h-4 w-4" />
                </li>
              ) : null}
            </Fragment>
          ))}
        </ol>
      </Card>

      <Card title="Team" description={`${team.length} ${team.length === 1 ? "person" : "people"} with access`} bodyClassName="p-0">
        <ul className="divide-y divide-border">
          {team.map((person) => (
            <li key={person.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={person.full_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {person.full_name}
                  {person.id === member.id ? <span className="font-normal text-muted"> (you)</span> : null}
                </p>
                <p className="truncate text-xs text-muted">{[person.department, person.email].filter(Boolean).join(" · ")}</p>
              </div>
              <Badge variant={person.role === "admin" ? "default" : person.role === "approver" ? "info" : "muted"}>
                {BUSINESS_ROLE_LABELS[person.role]}
              </Badge>
              {manage ? (
                <button
                  type="button"
                  onClick={() => setEditing(person)}
                  aria-label={`Edit ${person.full_name}`}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {editing ? <EditMemberModal person={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function EditMemberModal({ person, onClose }: { person: BusinessMember; onClose: () => void }) {
  const { account, run } = useBizDash();
  const [role, setRole] = useState<BusinessRole>(person.role);
  const [department, setDepartment] = useState(person.department ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await run(() => updateTeamMember(account.id, person.id, { role, department }), "Team member updated");
    setSaving(false);
    if (result.ok) onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={`Edit ${person.full_name}`}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Permission level" htmlFor="member-role" hint={ROLE_HELP[role]}>
          <Select id="member-role" value={role} onChange={(event) => setRole(event.target.value as BusinessRole)}>
            {BUSINESS_ROLES.map((option) => (
              <option key={option} value={option}>{BUSINESS_ROLE_LABELS[option]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Department" htmlFor="member-department">
          <Input id="member-department" value={department} maxLength={100} onChange={(event) => setDepartment(event.target.value)} className="h-11" />
        </Field>
      </div>
    </Modal>
  );
}
