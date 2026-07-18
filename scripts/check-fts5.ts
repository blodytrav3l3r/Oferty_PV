import prisma from '../src/prismaClient';

async function main() {
    const r: any[] = await prisma.$queryRawUnsafe(
        "SELECT sqlite_version() AS ver, (SELECT 1 FROM pragma_compile_options WHERE compile_options LIKE '%ENABLE_FTS5%') AS fts5"
    );
    console.log(JSON.stringify(r, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
}
main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
