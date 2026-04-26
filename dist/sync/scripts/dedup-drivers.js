/**
 * One-time cleanup: merge duplicate drivers created by dump vs API sync.
 * Keeps the dump record (has headshot URL, referenced by results/standings),
 * updates its jolpikaId to the slug, deletes the API-only duplicate.
 */
import prisma from "../../db/client.js";
// Try updateMany; if unique constraint blocks it (canonical already has that row), delete instead
async function reassignOrDelete(update, remove) {
    try {
        await update();
    }
    catch (e) {
        if (e?.code === "P2002") {
            await remove();
        }
        else {
            throw e;
        }
    }
}
const all = await prisma.driver.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
// Group by full name
const byName = new Map();
for (const d of all) {
    const key = `${d.firstName} ${d.lastName}`;
    const arr = byName.get(key) ?? [];
    arr.push(d);
    byName.set(key, arr);
}
const dupes = [...byName.entries()].filter(([, arr]) => arr.length > 1);
console.log(`Found ${dupes.length} duplicate driver name(s)`);
for (const [name, arr] of dupes) {
    // Prefer the record with a headshot URL (from dump) as canonical
    const canonical = arr.find(d => d.headshotUrl) ?? arr[0];
    const duplicates = arr.filter(d => d.id !== canonical.id);
    // Find the slug-style jolpikaId (no "driver_" prefix)
    const slugRecord = arr.find(d => d.jolpikaId && !d.jolpikaId.startsWith("driver_"));
    console.log(`\n  ${name}`);
    console.log(`    keep:   ${canonical.id} (jolpikaId: ${canonical.jolpikaId})`);
    console.log(`    delete: ${duplicates.map(d => `${d.id} (${d.jolpikaId})`).join(", ")}`);
    // Reassign FK references from duplicates to canonical
    for (const dup of duplicates) {
        await reassignOrDelete(() => prisma.result.updateMany({ where: { driverId: dup.id }, data: { driverId: canonical.id } }), () => prisma.result.deleteMany({ where: { driverId: dup.id } }));
        await reassignOrDelete(() => prisma.qualifyingResult.updateMany({ where: { driverId: dup.id }, data: { driverId: canonical.id } }), () => prisma.qualifyingResult.deleteMany({ where: { driverId: dup.id } }));
        await reassignOrDelete(() => prisma.driverSeason.updateMany({ where: { driverId: dup.id }, data: { driverId: canonical.id } }), () => prisma.driverSeason.deleteMany({ where: { driverId: dup.id } }));
        await reassignOrDelete(() => prisma.driverStanding.updateMany({ where: { driverId: dup.id }, data: { driverId: canonical.id } }), () => prisma.driverStanding.deleteMany({ where: { driverId: dup.id } }));
        await reassignOrDelete(() => prisma.lapTime.updateMany({ where: { driverId: dup.id }, data: { driverId: canonical.id } }), () => prisma.lapTime.deleteMany({ where: { driverId: dup.id } }));
        await reassignOrDelete(() => prisma.pitStop.updateMany({ where: { driverId: dup.id }, data: { driverId: canonical.id } }), () => prisma.pitStop.deleteMany({ where: { driverId: dup.id } }));
        // Null out jolpikaId on duplicate to free the unique constraint before updating canonical
        await prisma.driver.update({ where: { id: dup.id }, data: { jolpikaId: null } });
    }
    // Update canonical jolpikaId to slug if available
    if (slugRecord && canonical.id !== slugRecord.id) {
        await prisma.driver.update({
            where: { id: canonical.id },
            data: { jolpikaId: slugRecord.jolpikaId },
        });
        console.log(`    updated jolpikaId → ${slugRecord.jolpikaId}`);
    }
    // Delete duplicates
    for (const dup of duplicates) {
        await prisma.driver.delete({ where: { id: dup.id } });
    }
    console.log(`    deleted ${duplicates.length} duplicate(s)`);
}
console.log("\nDone.");
await prisma.$disconnect();
//# sourceMappingURL=dedup-drivers.js.map