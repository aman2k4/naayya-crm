# Yambooking CRM Cleanup Guide

After migrating CRM to naayya-crm, you can safely remove these files/folders from yambooking.

---

## Folders to DELETE Completely

These folders are **100% CRM-only** and can be safely deleted:

```
/Users/amanagarwal/Documents/personal/tools/yambooking/
├── app/crm/                    # DELETE - Entire CRM frontend
└── app/api/crm/                # DELETE - Entire CRM API
```

### Delete Commands:
```bash
rm -rf /Users/amanagarwal/Documents/personal/tools/yambooking/app/crm
rm -rf /Users/amanagarwal/Documents/personal/tools/yambooking/app/api/crm
```

---

## Files to DELETE

These files are **CRM-specific** and can be safely deleted:

```
/Users/amanagarwal/Documents/personal/tools/yambooking/
└── lib/crm/
    ├── emailTemplates.ts       # DELETE - CRM email templates
    └── emailStatusHelpers.ts   # DELETE - CRM email status helpers
```

### Delete Commands:
```bash
rm -rf /Users/amanagarwal/Documents/personal/tools/yambooking/lib/crm
```

---

## Files to KEEP (Shared Dependencies)

These files are used by both CRM and the main yambooking app - **DO NOT DELETE**:

```
/Users/amanagarwal/Documents/personal/tools/yambooking/
├── components/ui/*             # KEEP - Shared UI components
├── hooks/use-toast.ts          # KEEP - Used by main app
├── utils/permissions.ts        # KEEP - Used by main app
├── utils/supabase/*            # KEEP - Used by main app
├── lib/utils.ts                # KEEP - cn() utility used everywhere
├── types/crm.ts                # KEEP or DELETE (see note below)
├── types/resend.ts             # KEEP or DELETE (see note below)
└── types/database.ts           # KEEP - Used by main app
```

### Note on types/crm.ts and types/resend.ts:
- If no other part of yambooking imports these, you can delete them
- Check with: `grep -r "from.*types/crm" --include="*.ts" --include="*.tsx" | grep -v "app/crm" | grep -v "app/api/crm"`
- Check with: `grep -r "from.*types/resend" --include="*.ts" --include="*.tsx" | grep -v "app/crm" | grep -v "app/api/crm"`

---

## Summary

| Action | Path | Reason |
|--------|------|--------|
| DELETE | `app/crm/` | CRM frontend (42 files) |
| DELETE | `app/api/crm/` | CRM API routes (18 files) |
| DELETE | `lib/crm/` | CRM-specific lib (2 files) |
| MAYBE DELETE | `types/crm.ts` | Check if used elsewhere |
| MAYBE DELETE | `types/resend.ts` | Check if used elsewhere |
| KEEP | Everything else | Shared with main app |

---

## Total Files to Delete: ~62 files

After deletion, your yambooking project will no longer have any CRM functionality - it will all be in naayya-crm.
