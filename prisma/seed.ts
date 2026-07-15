import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // wipe existing data first so this script is safe to re-run
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.room.deleteMany();
  await prisma.person.deleteMany();
  await prisma.house.deleteMany();

  const house = await prisma.house.create({
    data: {
      name: "Jacopo & Chi's place",
      people: {
        create: [
          { username: "chi", email: "chi@example.com" },
          { username: "jacopo", email: "jacopo@example.com" },
        ],
      },
    },
    include: { people: true },
  });

  const chi = house.people.find((p) => p.username === "chi")!;
  const jacopo = house.people.find((p) => p.username === "jacopo")!;

  await prisma.room.create({
    data: {
      name: "Kitchen",
      houseId: house.id,
      tasks: {
        create: [
          {
            title: "Wipe counters",
            desc: "Clean all counter surfaces and stovetop",
            tools: ["all-purpose spray", "microfiber cloth"],
            howto: "Spray surface, wipe in circular motion, dry with clean side of cloth",
            dueDate: new Date(Date.now() + 86400000),
          },
          {
            title: "Empty dishwasher",
            desc: "Unload clean dishes and put away",
            tools: [],
            howto: "Unload top rack first, then bottom",
            dueDate: new Date(Date.now() - 86400000),
            completedAt: new Date(),
            assignedTo: { create: [{ personId: jacopo.id }] },
          },
        ],
      },
    },
  });

  await prisma.room.create({
    data: {
      name: "Living room",
      houseId: house.id,
      tasks: {
        create: [
          {
            title: "Mop floor",
            desc: "Mop the hardwood floor",
            tools: ["mop", "bucket", "wood floor cleaner"],
            howto: "Sweep first, then mop with diluted cleaner, let air dry",
            dueDate: new Date(Date.now() + 2 * 86400000),
          },
        ],
      },
    },
  });

  await prisma.room.create({
    data: {
      name: "Bathroom",
      houseId: house.id,
      tasks: {
        create: [
          {
            title: "Scrub tub",
            desc: "Deep clean the bathtub",
            tools: ["scrub brush", "bathroom cleaner"],
            howto: "Apply cleaner, let sit 5 minutes, scrub, rinse",
            dueDate: new Date(Date.now() + 3 * 86400000),
            assignedTo: { create: [{ personId: chi.id }] },
          },
        ],
      },
    },
  });

  console.log(`Seeded "${house.name}" with 3 rooms and 4 tasks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });