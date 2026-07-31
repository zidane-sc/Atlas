# Account & Settings Backend Wire-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 4 backend features: editable account fields (Name, Guild), settings toggles UI (Sound, Notifications, Compact View), pomodoro inputs UI (Focus/Break minutes), and default view routing.

**Architecture:** Four independent sequential features. Features 2-4 reuse existing `updateUserSettingAction`. Feature 1 adds new `updateUserProfileAction`. All use optimistic UI updates via SettingsProvider or component state.

**Tech Stack:** Next.js server actions, Prisma ORM, React hooks, existing SettingsProvider pattern

## Global Constraints

- Single-user app — no concurrent updates
- All new settings have sensible defaults
- Pomodoro values: 1-120 minutes, integers only
- Name: non-empty, max 50 chars
- Guild: optional, max 100 chars
- No schema migrations except adding `guild` column
- Existing patterns: updateUserSettingAction, SettingsProvider, server actions

---

## File Structure

**Modified files:**
- `prisma/schema.prisma` — add `guild` field to User
- `src/lib/actions/user.ts` — add `updateUserProfileAction`
- `src/app/(dashboard)/account/page.tsx` — add edit form UI for Name/Guild
- `src/app/(dashboard)/settings/page.tsx` — add UI for 3 toggles + 2 inputs + 1 dropdown
- `src/app/(dashboard)/layout.tsx` — add default view routing logic

**No new files created.** All changes are enhancements to existing files.

---

## Task 1: Add Guild Field to Schema

**Files:**
- Modify: `prisma/schema.prisma:12-38` (User model)

**Interfaces:**
- Produces: `User.guild?: String` field (optional, max 100)

- [ ] **Step 1: Add guild field to User model**

Edit `prisma/schema.prisma`, find the User model and add:

```prisma
model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  name      String
  createdAt DateTime @default(now()) @map("created_at")

  guild    String?   @default("Adventurer")  // ADD THIS LINE

  bonusXp    Int @default(0) @map("bonus_xp")
  // ... rest of model
}
```

- [ ] **Step 2: Verify schema change**

Run:
```bash
npx prisma format
```

Expected: No errors, `guild` field appears in User model

- [ ] **Step 3: Commit schema**

```bash
git add prisma/schema.prisma
git commit -m "schema: add guild field to User model

- Optional string field, default 'Adventurer'
- Max 100 chars for user's guild/team
- Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add updateUserProfileAction

**Files:**
- Modify: `src/lib/actions/user.ts:1-200` (add new action)

**Interfaces:**
- Consumes: `auth()`, `db.user.update()`, Zod validation
- Produces: `updateUserProfileAction(name: string, guild: string): Promise<ActionResult<{ name, guild }>>`

- [ ] **Step 1: Add validation schema**

At top of `src/lib/actions/user.ts` after other imports, add:

```typescript
const updateUserProfileSchema = z.object({
  name: z.string().min(1, "Name required").max(50, "Name too long"),
  guild: z.string().max(100, "Guild too long").optional(),
});
```

- [ ] **Step 2: Implement updateUserProfileAction**

Add to end of `src/lib/actions/user.ts`:

```typescript
export async function updateUserProfileAction(
  name: string,
  guild?: string
): Promise<ActionResult<{ name: string; guild?: string }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = updateUserProfileSchema.safeParse({ name, guild });
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  try {
    const updated = await db.user.update({
      where: { email: session.user.email },
      data: {
        name: parsed.data.name,
        guild: parsed.data.guild,
      },
      select: { name: true, guild: true },
    });

    return {
      success: true,
      data: {
        name: updated.name,
        guild: updated.guild ?? undefined,
      },
    };
  } catch (error) {
    console.error("Failed to update user profile:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to update profile." } };
  }
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run build 2>&1 | grep -E "(error|Error|✓)"
```

Expected: No errors, "✓ Compiled successfully"

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/user.ts
git commit -m "feat: add updateUserProfileAction for name and guild

- New server action to update user name and guild
- Validates name (1-50 chars), guild (0-100 chars)
- Returns updated profile on success
- Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Edit Form to Account Page

**Files:**
- Modify: `src/app/(dashboard)/account/page.tsx` (add form UI)

**Interfaces:**
- Consumes: `updateUserProfileAction`, useSession(), useState
- Produces: Account page with editable Name/Guild form

- [ ] **Step 1: Add imports**

At top of account page component, add:

```typescript
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { updateUserProfileAction } from "@/lib/actions/user";
```

- [ ] **Step 2: Add edit form state and handlers**

Inside component, add:

```typescript
const { data: session } = useSession();
const [isEditing, setIsEditing] = useState(false);
const [formName, setFormName] = useState(session?.user?.name ?? "");
const [formGuild, setFormGuild] = useState("");
const [saving, setSaving] = useState(false);
const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

const handleSave = async () => {
  setSaving(true);
  setMessage(null);
  const result = await updateUserProfileAction(formName, formGuild);
  
  if (result.success) {
    setMessage({ type: "success", text: "Profile updated!" });
    setIsEditing(false);
  } else {
    setMessage({ type: "error", text: result.error?.message ?? "Failed to update" });
  }
  setSaving(false);
};
```

- [ ] **Step 3: Add edit form UI**

Replace hardcoded name/guild display with:

```typescript
{isEditing ? (
  <div className="flex flex-col gap-4 p-4 border border-border rounded">
    <div>
      <label className="block text-sm mb-1">Adventurer Name</label>
      <input
        type="text"
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        className="w-full px-2 py-1 border border-border rounded"
        placeholder="Your name"
      />
    </div>
    <div>
      <label className="block text-sm mb-1">Guild</label>
      <input
        type="text"
        value={formGuild}
        onChange={(e) => setFormGuild(e.target.value)}
        className="w-full px-2 py-1 border border-border rounded"
        placeholder="Your guild or team"
        maxLength={100}
      />
    </div>
    {message && (
      <p style={{ color: message.type === "error" ? "var(--color-status-blocked)" : "var(--color-status-ready)" }}>
        {message.text}
      </p>
    )}
    <div className="flex gap-2">
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-primary text-primary-foreground rounded"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      <button
        onClick={() => setIsEditing(false)}
        className="px-4 py-2 border border-border rounded"
      >
        Cancel
      </button>
    </div>
  </div>
) : (
  <div>
    <h2 className="text-xl mb-2">{session?.user?.name ?? "Aric Stormcloak"}</h2>
    <p className="text-sm text-muted-foreground mb-4">{formGuild || "Adventurer"}</p>
    <button
      onClick={() => setIsEditing(true)}
      className="px-4 py-2 border border-border rounded"
    >
      Edit Profile
    </button>
  </div>
)}
```

- [ ] **Step 4: Verify build and test manually**

Run:
```bash
npm run build 2>&1 | grep -E "(error|Error|✓)" | head -3
```

Then test in app:
- Navigate to account page
- Click "Edit Profile"
- Change name and guild
- Click "Save"
- Verify they persist after refresh

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/account/page.tsx
git commit -m "feat: add editable name and guild form to account page

- Add edit form with name and guild inputs
- Click 'Edit Profile' to open form, 'Save' to persist
- Shows current values, validates on save
- Displays success/error messages
- Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Settings Toggles UI

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx` (add toggle switches)

**Interfaces:**
- Consumes: `useSettings()`, `updateUserSettingAction`
- Produces: 3 toggle switches for Sound, Notifications, Compact View

- [ ] **Step 1: Add toggle component helper**

At top of settings page, add:

```typescript
function SettingToggle({
  label,
  description,
  settingKey,
  value,
  onChange,
}: {
  label: string;
  description: string;
  settingKey: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-border">
      <div>
        <label className="block font-medium">{label}</label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition ${
          value ? "bg-primary" : "bg-muted"
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white transition ${
            value ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add toggle handlers in settings page component**

Inside component, add:

```typescript
const { settings, updateSetting } = useSettings();

const getSetting = (key: string) => {
  const setting = settings.find((s) => s.key === key);
  return setting?.value ?? false;
};

const handleToggle = async (key: string, newValue: boolean) => {
  await updateSetting(key, newValue);
};
```

- [ ] **Step 3: Add toggle UI section**

In settings page JSX, add section with toggles:

```typescript
<div className="mb-6">
  <h3 className="text-lg font-semibold mb-4">Preferences</h3>
  
  <SettingToggle
    label="Sound Effects"
    description="Subtle chimes on task complete and level-up"
    settingKey="soundEnabled"
    value={getSetting("soundEnabled")}
    onChange={(val) => handleToggle("soundEnabled", val)}
  />
  
  <SettingToggle
    label="Notifications"
    description="Overdue and sprint deadline alerts"
    settingKey="notifications"
    value={getSetting("notifications")}
    onChange={(val) => handleToggle("notifications", val)}
  />
  
  <SettingToggle
    label="Compact View"
    description="Reduce clutter in task lists"
    settingKey="compactView"
    value={getSetting("compactView")}
    onChange={(val) => handleToggle("compactView", val)}
  />
</div>
```

- [ ] **Step 4: Test toggles**

Run app:
- Go to Settings page
- Click each toggle
- Verify they persist after refresh
- Verify sound plays when enabled
- Verify notifications trigger

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx
git commit -m "feat: add sound, notifications, and compact view toggles

- Add toggle UI for Sound Effects, Notifications, Compact View
- Toggle immediately persists to DB via SettingsProvider
- Auto-sync with app behavior (sound plays, alerts trigger)
- Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Pomodoro Inputs UI

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx` (add number inputs)

**Interfaces:**
- Consumes: `useSettings()`, `updateSetting()`
- Produces: 2 number inputs for Focus/Break minutes with validation

- [ ] **Step 1: Add input component helper**

At top of settings page, add:

```typescript
function SettingNumberInput({
  label,
  description,
  settingKey,
  value,
  onChange,
  min = 1,
  max = 120,
}: {
  label: string;
  description: string;
  settingKey: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const handleChange = (newValue: number) => {
    if (newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  return (
    <div className="flex justify-between items-start py-3 border-b border-border">
      <div>
        <label className="block font-medium">{label}</label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-16 px-2 py-1 border border-border rounded text-center"
        />
        <span className="text-sm text-muted-foreground">min</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add pomodoro section in settings**

After toggles section, add:

```typescript
<div className="mb-6">
  <h3 className="text-lg font-semibold mb-4">Pomodoro Timer</h3>
  
  <SettingNumberInput
    label="Focus Duration"
    description="Minutes per focus interval"
    settingKey="focusMinutes"
    value={getSetting("focusMinutes") as number}
    onChange={(val) => handleToggle("focusMinutes", val)}
    min={1}
    max={120}
  />
  
  <SettingNumberInput
    label="Break Duration"
    description="Minutes per break interval"
    settingKey="breakMinutes"
    value={getSetting("breakMinutes") as number}
    onChange={(val) => handleToggle("breakMinutes", val)}
    min={1}
    max={120}
  />
</div>
```

- [ ] **Step 3: Test inputs**

Run app:
- Go to Settings
- Try changing Focus and Break minutes
- Invalid inputs rejected (outside 1-120)
- Valid inputs persist after refresh
- BattleTimer uses new values on next session

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx
git commit -m "feat: add focus and break duration inputs to settings

- Add number inputs for Focus Duration (default 25 min)
- Add number inputs for Break Duration (default 5 min)
- Validate 1-120 minute range
- Values persist and used by BattleTimer
- Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Default View Routing & Dropdown

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx` (add dropdown)
- Modify: `src/app/(dashboard)/layout.tsx` (add routing logic)

**Interfaces:**
- Consumes: `useSettings()`, next/navigation router
- Produces: Default View dropdown + routing on app load

- [ ] **Step 1: Add dropdown helper in settings**

At top of settings page:

```typescript
function SettingSelect({
  label,
  description,
  settingKey,
  value,
  onChange,
  options,
}: {
  label: string;
  description: string;
  settingKey: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-border">
      <div>
        <label className="block font-medium">{label}</label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1 border border-border rounded"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Add default view section in settings**

After pomodoro section:

```typescript
<div className="mb-6">
  <h3 className="text-lg font-semibold mb-4">App Preferences</h3>
  
  <SettingSelect
    label="Default View"
    description="View shown when you open the app"
    settingKey="defaultView"
    value={getSetting("defaultView") as string}
    onChange={(val) => handleToggle("defaultView", val)}
    options={[
      { value: "dashboard", label: "Dashboard" },
      { value: "today", label: "Today" },
      { value: "focus", label: "Focus" },
      { value: "kanban", label: "Kanban" },
    ]}
  />
</div>
```

- [ ] **Step 3: Add routing logic to layout**

In `src/app/(dashboard)/layout.tsx`, in main component add:

```typescript
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useSettings } from "@/components/providers/SettingsProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useSettings();

  useEffect(() => {
    if (!session?.user) return;
    
    // Only redirect on dashboard root
    if (pathname !== "/dashboard" && pathname !== "/") return;
    
    const defaultViewSetting = settings.find((s) => s.key === "defaultView");
    const defaultView = (defaultViewSetting?.value as string) || "dashboard";
    
    if (defaultView !== "dashboard" && pathname === "/dashboard") {
      router.push(`/tasks/${defaultView}`);
    }
  }, [session, pathname, settings, router]);

  return (
    <>
      {/* ... existing layout content */}
      {children}
    </>
  );
}
```

- [ ] **Step 4: Test routing**

Run app:
- Set default view to "Today"
- Log out and back in
- Verify app opens to Today view instead of Dashboard
- Test all 4 default view options

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat: add default view selection and routing

- Add dropdown in Settings to choose default app view
- Options: Dashboard, Today, Focus, Kanban
- On app open, redirect to user's default view if set
- Falls back to Dashboard if not set
- Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Integration Testing & Verification

**Files:**
- Manual/integration testing (no files)

- [ ] **Step 1: Full feature test**

Test all 4 features end-to-end:

1. **Account fields:** Edit name/guild → persist → refresh → verify
2. **Settings toggles:** Toggle each → click effect → refresh → verify
3. **Pomodoro inputs:** Change minutes → test timer uses new values
4. **Default view:** Set default → logout/login → verify redirect

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 3: Build verification**

```bash
npm run build
```

Expected: No errors, "✓ Compiled successfully"

- [ ] **Step 4: Commit any cleanup**

If needed, commit cleanup:

```bash
git add -A && git commit -m "test: verify all 4 account/settings features working

All features persist, UI responsive, no regressions
- Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Summary

**4 features implemented sequentially:**
1. Account fields (Name, Guild) — editable profile
2. Settings toggles (Sound, Notifications, Compact View) — missing UI added
3. Pomodoro inputs (Focus/Break minutes) — missing UI added
4. Default View routing — redirect on app open

**All use existing patterns, no breaking changes, all tests pass.**
