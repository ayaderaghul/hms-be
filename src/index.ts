import express from "express"
import "dotenv/config";
import cors from "cors"
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { upload } from "./upload.js";
import { uploadToCloudinary } from "./utils/uploadCloudinary.js";
import type { Request, Response } from "express";const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

const app = express()
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://hms-fe-l3j1.onrender.com",
  ],
}));

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
      people: true
    },
  });

  const summary = houses.map((house) => {
    const allTasks = house.rooms.flatMap((room) => room.tasks);
    return {
      id: house.id,
      name: house.name,
      totalTasks: allTasks.length,
      doneTasks: allTasks.filter((t) => t.completedAt !== null).length,
          people: house.people.map((p) => ({ id: p.id, username: p.username })),

    };
  });

  res.json(summary);
});

app.get("/api/houses/:id", async (req, res) => {
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

  const allTasks = house.rooms.flatMap((room) => room.tasks);
  const summary = {
      id: house.id,
      name: house.name,
      totalTasks: allTasks.length,
      doneTasks: allTasks.filter((t) => t.completedAt !== null).length,
    };
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

  res.json({ id: room.id, name: room.name, houseId: room.houseId, tasks: room.tasks });
});
type RoomParams = {
  id: string;
};
app.post(
  "/api/rooms/:id/tasks",
  upload.fields([
    { name: "descImages", maxCount: 5 },
    { name: "toolImages", maxCount: 5 },
    { name: "howtoImages", maxCount: 10 },
  ]),
  async (req: Request<RoomParams>, res: Response) => {
    const { id } = req.params;

    if (
      !req.body ||
      !req.body.title ||
      typeof req.body.title !== "string" ||
      !req.body.title.trim()
    ) {
      return res.status(400).json({ error: "Title is required" });
    }

    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const files = req.files as {
      [field: string]: Express.Multer.File[];
    };

    const descImages = files?.descImages
      ? await Promise.all(
          files.descImages.map((f) => uploadToCloudinary(f, "image"))
        )
      : [];

    const toolImages = files?.toolImages
      ? await Promise.all(
          files.toolImages.map((f) => uploadToCloudinary(f, "image"))
        )
      : [];

    const howtoImages = files?.howtoImages
      ? await Promise.all(
          files.howtoImages.map((f) => uploadToCloudinary(f, "image"))
        )
      : [];

    const task = await prisma.task.create({
      data: {
        title: req.body.title.trim(),
        desc: req.body.desc ?? "",
        tools: req.body.tools ? JSON.parse(req.body.tools) : [],
        howto: req.body.howto ?? "",
        dueDate: req.body.dueDate
          ? new Date(req.body.dueDate)
          : null,
        descImages,
        toolImages,
        howtoImages,
        roomId: id,
      },
    });

    res.status(201).json(task);
  }
);
// GET /api/tasks
app.get("/api/tasks", async (req, res) => {
  const tasks = await prisma.task.findMany({
    include: {
      room: {
        include: {
          house: true,
        },
      },
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  res.json(tasks);
});
// src/index.ts
app.get("/api/tasks/:id", async (req, res) => {
  const task = await prisma.task.findUnique({ 
    where: { id: req.params.id },
    include: {
      room: {
        select: {id: true, houseId: true}
      },
      assignedTo: {
        include: {
          person: {
            select: {id: true, username: true}
          } 
        }
      }
    }
  });
  console.log(task)
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

// src/index.ts
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    await prisma.taskAssignment.deleteMany({ where: { taskId: req.params.id } });
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Task not found" });
  }
});

// src/index.ts
app.patch("/api/tasks/:id/complete", async (req, res) => {
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { completedAt: new Date() },
    });
    res.json(task);
  } catch {
    res.status(404).json({ error: "Task not found" });
  }
});

app.patch(
"/api/tasks/:id",
upload.fields([
  {
    name:"descImages",
    maxCount:5
  },
  {
    name:"toolImages",
    maxCount:5
  },
  {
    name:"howtoImages",
    maxCount:10
  },
  {
    name:"howtoVideo",
    maxCount:1
  }
]),

async(req,res)=>{
const { id } = req.params;

      if (!id || Array.isArray(id)) {
        res.status(400).json({
          error: "Invalid task id",
        });
        return;
      }


      console.log("BODY:", req.body);
      console.log("FILES:", req.files);

 const files=req.files as {
   [field:string]: Express.Multer.File[]
 };


 const descImages =
 files.descImages
 ? await Promise.all(
     files.descImages.map(
       f=>uploadToCloudinary(f,"image")
     )
   )
 : [];


 const toolImages =
 files.toolImages
 ? await Promise.all(
     files.toolImages.map(
       f=>uploadToCloudinary(f,"image")
     )
   )
 : [];


 const howtoImages =
 files.howtoImages
 ? await Promise.all(
     files.howtoImages.map(
       f=>uploadToCloudinary(f,"image")
     )
   )
 : [];


const existingTask = await prisma.task.findUnique({
  where: {
    id,
  },
});

if (!existingTask) {
  res.status(404).json({
    error: "Task not found",
  });
  return;
}


const task = await prisma.task.update({
  where: {
    id,
  },

  data: {

    title: req.body.title,

    desc: req.body.desc,

    tools: req.body.tools
      ? JSON.parse(req.body.tools)
      : existingTask.tools,

    howto: req.body.howto,


    // keep old images if no new upload
    descImages:
      descImages.length > 0
        ? [
            ...existingTask.descImages,
            ...descImages,
          ]
        : existingTask.descImages,


    toolImages:
      toolImages.length > 0
        ? [
            ...existingTask.toolImages,
            ...toolImages,
          ]
        : existingTask.toolImages,


    howtoImages:
      howtoImages.length > 0
        ? [
            ...existingTask.howtoImages,
            ...howtoImages,
          ]
        : existingTask.howtoImages,

  },
});


const assignedTo: string[] = req.body.assignedTo
  ? JSON.parse(req.body.assignedTo)
  : [];

await prisma.$transaction(async (tx) => {
  await tx.task.update({
    where: { id },
    data: {
      title: req.body.title,
      desc: req.body.desc,
      tools: req.body.tools
        ? JSON.parse(req.body.tools)
        : existingTask.tools,
      howto: req.body.howto,

      descImages:
        descImages.length > 0
          ? [...existingTask.descImages, ...descImages]
          : existingTask.descImages,

      toolImages:
        toolImages.length > 0
          ? [...existingTask.toolImages, ...toolImages]
          : existingTask.toolImages,

      howtoImages:
        howtoImages.length > 0
          ? [...existingTask.howtoImages, ...howtoImages]
          : existingTask.howtoImages,
    },
  });

  await tx.taskAssignment.deleteMany({
    where: {
      taskId: id,
    },
  });

  if (assignedTo.length > 0) {
    await tx.taskAssignment.createMany({
      data: assignedTo.map((personId) => ({
        taskId: id,
        personId,
      })),
    });
  }
});

const updatedTask = await prisma.task.findUnique({
  where: { id },
  include: {
    room: true,
    assignedTo: {
      include: {
        person: true,
      },
    },
  },
});

res.json(updatedTask);

});


// src/index.ts
app.get("/api/houses/:id/people", async (req, res) => {
  const people = await prisma.person.findMany({
    where: { houseId: req.params.id },
    include: {
      tasks: {
        include: { task: true },
      },
    },
  });

  const result = people.map((p) => ({
    id: p.id,
    username: p.username,
    email: p.email,
    tasks: p.tasks.map((assignment) => ({
      id: assignment.task.id,
      title: assignment.task.title,
      completedAt: assignment.task.completedAt,
    })),
  }));

  res.json(result);
});


app.post("/api/houses/:id/people", async (req, res) => {
  const { username, email } = req.body;

  if (!username || typeof username !== "string" || !username.trim()) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  const house = await prisma.house.findUnique({ where: { id: req.params.id } });
  if (!house) {
    res.status(404).json({ error: "House not found" });
    return;
  }

  const person = await prisma.person.create({
    data: {
      username: username.trim(),
      email: email ?? "",
      houseId: req.params.id,
    },
  });

  res.status(201).json(person);
});


// src/index.ts
app.get("/api/people/:id", async (req, res) => {
  const person = await prisma.person.findUnique({
    where: {
      id: req.params.id,
    },
    include: {
      tasks: {
        include: {
          task: {
            include: {
              room: true,
            },
          },
        },
      },
    },
  });

  if (!person) {
    res.status(404).json({
      error: "Person not found",
    });
    return;
  }

  res.json({
    id: person.id,
    username: person.username,
    email: person.email,
    phone: person.phone,
    avatarUrl: null,

    waitingTasks: person.tasks
      .map(t => t.task)
      .filter(task => !task.completedAt),

    completedTasks: person.tasks
      .map(t => t.task)
      .filter(task => task.completedAt),
  });
});

app.delete("/api/people/:id", async (req, res) => {
  try {
    // remove their task assignments first — Postgres will reject the
    // person delete otherwise, since TaskAssignment rows still reference them
    await prisma.taskAssignment.deleteMany({ where: { personId: req.params.id } });
    await prisma.person.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Person not found" });
  }
});

// src/index.ts

// list templates available to a room (looked up via the room's house)
app.get("/api/rooms/:id/templates", async (req, res) => {
  const room = await prisma.room.findUnique({ where: { id: req.params.id } });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  const templates = await prisma.taskTemplate.findMany({ where: { houseId: room.houseId } });
  res.json(templates);
});

type HouseParams = {
  id: string;
};

// create a new template for a house
app.post(
  "/api/houses/:id/templates",
  upload.fields([
    { name: "descImages", maxCount: 5 },
    { name: "toolImages", maxCount: 5 },
    { name: "howtoImages", maxCount: 10 },
  ]),
  async (req: express.Request<HouseParams>, res) => {
    const { id } = req.params;

    if (!req.body.title || typeof req.body.title !== "string" || !req.body.title.trim()) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const house = await prisma.house.findUnique({ where: { id } });
    if (!house) {
      res.status(404).json({ error: "House not found" });
      return;
    }

    const files = req.files as { [field: string]: Express.Multer.File[] };

    const descImages = files.descImages
      ? await Promise.all(files.descImages.map((f) => uploadToCloudinary(f, "image")))
      : [];
    const toolImages = files.toolImages
      ? await Promise.all(files.toolImages.map((f) => uploadToCloudinary(f, "image")))
      : [];
    const howtoImages = files.howtoImages
      ? await Promise.all(files.howtoImages.map((f) => uploadToCloudinary(f, "image")))
      : [];

    const template = await prisma.taskTemplate.create({
      data: {
        title: req.body.title.trim(),
        desc: req.body.desc ?? "",
        tools: req.body.tools ? JSON.parse(req.body.tools) : [],
        howto: req.body.howto ?? "",
        descImages,
        toolImages,
        howtoImages,
        houseId: id,
      },
    });

    res.status(201).json(template);
  }
);
// stamp a task into a room from a template
app.post("/api/rooms/:id/tasks/from-template/:templateId", async (req, res) => {
  const room = await prisma.room.findUnique({ where: { id: req.params.id } });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const template = await prisma.taskTemplate.findUnique({ where: { id: req.params.templateId } });
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const { dueDate } = req.body;

  const task = await prisma.task.create({
    data: {
      title: template.title,
      desc: template.desc,
      tools: template.tools,
      howto: template.howto,
      descImages: template.descImages,
      toolImages: template.toolImages,
      howtoImages: template.howtoImages,
      dueDate: dueDate ? new Date(dueDate) : null,
      roomId: req.params.id,
    },
  });

  res.status(201).json(task);
});


app.listen(PORT, ()=>{
    console.log(`Server running on http://localhost:${PORT}`)
})