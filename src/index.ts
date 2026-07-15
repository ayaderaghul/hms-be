import express from "express"
import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client.js";

import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

const app = express()
app.use(express.json());


const PORT = 3001

app.get("/api/health", (req,res) => {
    res.json({status: "ok"})
})
// src/index.ts
app.get("/api/houses", async (req, res) => {
  const houses = await prisma.house.findMany({
    include: {
      rooms: {
        include: { tasks: true },
      },
    },
  });

  const summary = houses.map((house) => {
    const allTasks = house.rooms.flatMap((room) => room.tasks);
    return {
      id: house.id,
      name: house.name,
      totalTasks: allTasks.length,
      doneTasks: allTasks.filter((t) => t.completedAt !== null).length,
    };
  });

  res.json(summary);
});
app.get("/api/rooms", async(req,res) => {
    const rooms = await prisma.room.findMany({
        include: {tasks: true}
    })
    res.json(rooms)
})

// src/index.ts
app.post("/api/houses", async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const house = await prisma.house.create({
    data: { name: name.trim() },
  });

  res.status(201).json(house);
});


// src/index.ts
app.get("/api/houses/:id/rooms", async (req, res) => {
  const house = await prisma.house.findUnique({
    where: { id: req.params.id },
    include: {
      rooms: {
        include: { tasks: true },
      },
    },
  });

  if (!house) {
    res.status(404).json({ error: "House not found" });
    return;
  }

  const rooms = house.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    totalTasks: room.tasks.length,
    doneTasks: room.tasks.filter((t) => t.completedAt !== null).length,
  }));

  res.json({ id: house.id, name: house.name, rooms });
});

// src/index.ts
app.post("/api/houses/:id/rooms", async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const house = await prisma.house.findUnique({ where: { id: req.params.id } });
  if (!house) {
    res.status(404).json({ error: "House not found" });
    return;
  }

  const room = await prisma.room.create({
    data: { name: name.trim(), houseId: req.params.id },
  });

  res.status(201).json(room);
});

// src/index.ts
app.get("/api/rooms/:id/tasks", async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: { tasks: true },
  });

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json({ id: room.id, name: room.name, tasks: room.tasks });
});

app.post("/api/rooms/:id/tasks", async (req, res) => {
  const { title, desc, tools, howto, dueDate } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const room = await prisma.room.findUnique({ where: { id: req.params.id } });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      desc: desc ?? "",
      tools: tools ?? [],
      howto: howto ?? "",
      dueDate: dueDate ? new Date(dueDate) : null,
      roomId: req.params.id,
    },
  });

  res.status(201).json(task);
});

// src/index.ts
app.get("/api/tasks/:id", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

app.patch("/api/tasks/:id", async (req, res) => {
  const { title, desc, tools, howto, dueDate } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        title: title.trim(),
        desc: desc ?? "",
        tools: tools ?? [],
        howto: howto ?? "",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });
    res.json(task);
  } catch {
    res.status(404).json({ error: "Task not found" });
  }
});


app.listen(PORT, ()=>{
    console.log(`Server running on http://localhost:${PORT}`)
})