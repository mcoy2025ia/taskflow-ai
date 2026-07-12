import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Existing user IDs from seed-users.ts
const users = [
  {
    email: "mcoyllmdata@gmail.com",
    id: "38bd6ec2-28e8-4f52-86c7-e7e2a61bd94c",
    name: "María Coy",
  },
  {
    email: "demo1@example.com",
    id: "d9d36f55-c29e-4ac8-85c6-f0c71ad0d9ca",
    name: "Demo User 1",
  },
  {
    email: "demo2@example.com",
    id: "cda4d105-c495-4f6f-a567-ae89c3f98923",
    name: "Demo User 2",
  },
];

const sampleTasks = [
  {
    title: "Implementar autenticación con Supabase",
    description: "Integrar login/signup usando Supabase Auth con RLS",
    status: "done" as const,
    priority: "high" as const,
  },
  {
    title: "Diseñar tablero Kanban",
    description: "Crear UI responsiva con drag-drop",
    status: "done" as const,
    priority: "high" as const,
  },
  {
    title: "Setup base de datos PostgreSQL",
    description: "Crear tablas, índices y funciones SQL",
    status: "done" as const,
    priority: "high" as const,
  },
  {
    title: "Importación CSV de tareas",
    description: "Implementar parser y batch insert",
    status: "in_progress" as const,
    priority: "medium" as const,
  },
  {
    title: "Sincronización en tiempo real",
    description: "Integrar Supabase Realtime para actualizaciones",
    status: "in_progress" as const,
    priority: "medium" as const,
  },
  {
    title: "Agente RAG con tool calling",
    description: "Integrar Groq con búsqueda vectorial Voyage AI",
    status: "in_progress" as const,
    priority: "high" as const,
  },
  {
    title: "Dashboard de analítica",
    description: "Gráficos de velocidad, burndown y predicciones",
    status: "todo" as const,
    priority: "medium" as const,
  },
  {
    title: "Rate limiting con Upstash",
    description: "Implementar límites de API: chat, embed, report",
    status: "todo" as const,
    priority: "medium" as const,
  },
  {
    title: "Email de invitaciones",
    description: "Integrar Resend para invitar colaboradores",
    status: "todo" as const,
    priority: "low" as const,
  },
  {
    title: "Tests E2E con Playwright",
    description: "Cobertura completa de flujos críticos",
    status: "todo" as const,
    priority: "medium" as const,
  },
];

async function seedProjectsAndTasks() {
  console.log("🌱 Creating projects and tasks...\n");

  let projectCount = 0;
  let taskCount = 0;

  // Create projects for each user
  for (const user of users) {
    try {
      console.log(`📦 Creating project for ${user.name}...`);

      // Create project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: `${user.name}'s Taskflow Project`,
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          delivery_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        })
        .select()
        .single();

      if (projectError) throw projectError;
      projectCount++;

      console.log(`✓ Project created: ${project.id}`);

      // Create tasks for this project
      const tasksToInsert = sampleTasks.map((task, idx) => ({
        ...task,
        user_id: user.id,
        project_id: project.id,
        position: (idx + 1) * 1000,
        due_date:
          Math.random() > 0.5
            ? new Date(
                Date.now() + (Math.random() * 60 - 30) * 24 * 60 * 60 * 1000
              ).toISOString()
            : null,
      }));

      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .insert(tasksToInsert)
        .select();

      if (tasksError) throw tasksError;
      taskCount += tasks?.length || 0;

      console.log(`✓ Created ${tasks?.length || 0} tasks for this project\n`);
    } catch (error) {
      console.error(`✗ Error creating project for ${user.name}:`, error);
    }
  }

  // Create a shared project with all users
  try {
    console.log("🤝 Creating shared collaborative project...");

    const { data: sharedProject, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: users[0].id, // Owner is first user
        name: "Taskflow Team Project",
        start_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        delivery_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      })
      .select()
      .single();

    if (projectError) throw projectError;
    projectCount++;

    // Add all users as members
    const memberInserts = users.map((user, idx) => ({
      project_id: sharedProject.id,
      user_id: user.id,
      role: idx === 0 ? "owner" : "editor",
    }));

    const { error: membersError } = await supabase
      .from("project_members")
      .insert(memberInserts);

    if (membersError) throw membersError;

    // Add some shared tasks
    const sharedTasksToInsert = sampleTasks.slice(0, 5).map((task, idx) => ({
      ...task,
      user_id: users[idx % users.length].id,
      project_id: sharedProject.id,
      position: (idx + 1) * 1000,
      title: `[SHARED] ${task.title}`,
    }));

    const { data: sharedTasks, error: tasksError } = await supabase
      .from("tasks")
      .insert(sharedTasksToInsert)
      .select();

    if (tasksError) throw tasksError;
    taskCount += sharedTasks?.length || 0;

    console.log(
      `✓ Shared project created with ${users.length} members and ${sharedTasks?.length || 0} tasks\n`
    );
  } catch (error) {
    console.error("✗ Error creating shared project:", error);
  }

  // Summary
  console.log("═══════════════════════════════════════════════════════════");
  console.log("✅ SEED COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`📦 Projects created: ${projectCount}`);
  console.log(`📝 Tasks created: ${taskCount}`);
  console.log("");
  console.log("🔐 LOGIN CREDENTIALS:");
  console.log("───────────────────────────────────────────────────────────");
  users.forEach((user) => {
    console.log(`📧 ${user.email}`);
    console.log(`🔑 Password: ${user.email === "mcoyllmdata@gmail.com" ? "Supabase2026" : "Demo1234"}`);
    console.log("");
  });
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🚀 Ready to test! Run: npm run dev");
  console.log("═══════════════════════════════════════════════════════════");
}

seedProjectsAndTasks().catch(console.error);
