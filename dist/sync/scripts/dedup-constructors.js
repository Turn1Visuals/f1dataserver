/**
 * One-time cleanup: merge duplicate constructors created by dump vs API sync.
 * Keeps the dump record (has team colour, referenced by results/standings),
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
const all = await prisma.constructor.findMany({ orderBy: { name: "asc" } });
// Group by name
const byName = new Map();
for (const c of all) {
    const arr = byName.get(c.name) ?? [];
    arr.push(c);
    byName.set(c.name, arr);
}
const dupes = [...byName.entries()].filter(([, arr]) => arr.length > 1);
console.log(`Found ${dupes.length} duplicate constructor name(s)`);
for (const [name, arr] of dupes) {
    // Prefer the record with a team colour (from dump) as canonical
    const canonical = arr.find(c => c.teamColour) ?? arr[0];
    const duplicates = arr.filter(c => c.id !== canonical.id);
    // Find the slug-style jolpikaId (no "team_" prefix)
    const slugRecord = arr.find(c => c.jolpikaId && !c.jolpikaId.startsWith("team_"));
    console.log(`\n  ${name}`);
    console.log(`    keep:   ${canonical.id} (jolpikaId: ${canonical.jolpikaId})`);
    console.log(`    delete: ${duplicates.map(d => `${d.id} (${d.jolpikaId})`).join(", ")}`);
    for (const dup of duplicates) {
        await reassignOrDelete(() => prisma.result.updateMany({ where: { constructorId: dup.id }, data: { constructorId: canonical.id } }), () => prisma.result.deleteMany({ where: { constructorId: dup.id } }));
        await reassignOrDelete(() => prisma.qualifyingResult.updateMany({ where: { constructorId: dup.id }, data: { constructorId: canonical.id } }), () => prisma.qualifyingResult.deleteMany({ where: { constructorId: dup.id } }));
        await reassignOrDelete(() => prisma.driverSeason.updateMany({ where: { constructorId: dup.id }, data: { constructorId: canonical.id } }), () => prisma.driverSeason.deleteMany({ where: { constructorId: dup.id } }));
        await reassignOrDelete(() => prisma.constructorStanding.updateMany({ where: { constructorId: dup.id }, data: { constructorId: canonical.id } }), () => prisma.constructorStanding.deleteMany({ where: { constructorId: dup.id } }));
        // Null out jolpikaId on duplicate to free the unique constraint before updating canonical
        await prisma.constructor.update({ where: { id: dup.id }, data: { jolpikaId: null } });
    }
    // Update canonical jolpikaId to slug if available
    if (slugRecord && canonical.id !== slugRecord.id) {
        await prisma.constructor.update({
            where: { id: canonical.id },
            data: { jolpikaId: slugRecord.jolpikaId },
        });
        console.log(`    updated jolpikaId → ${slugRecord.jolpikaId}`);
    }
    // Delete duplicates
    for (const dup of duplicates) {
        await prisma.constructor.delete({ where: { id: dup.id } });
    }
    console.log(`    deleted ${duplicates.length} duplicate(s)`);
}
console.log("\nDone.");
await prisma.$disconnect();
//# sourceMappingURL=dedup-constructors.js.map