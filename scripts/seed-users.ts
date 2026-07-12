import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface TestUser {
  email: string
  password: string
  fullName: string
}

const TEST_USERS: TestUser[] = [
  { email: "mcoyllmdata@gmail.com", password: "Supabase2026", fullName: "María Coy" },
  { email: "demo1@example.com", password: "Demo1234", fullName: "Demo User 1" },
  { email: "demo2@example.com", password: "Demo1234", fullName: "Demo User 2" },
]

const SAMPLE_TASKS = [
  {
    title: "Implement user authentication flow",
    description: "Set up login/register forms with Supabase Auth",
    priority: "high" as const,
    status: "in_progress" as const,
  },
  {
    title: "Design kanban board UI",
    description: "Create responsive Kanban board with drag-and-drop",
    priority: "high" as const,
    status: "in_progress" as const,
  },
  {
    title: "Set up database migrations",
    description: "Run all database migrations and verify schema",
    priority: "medium" as const,
    status: "done" as const,
  },
  {
    title: "Implement CSV import feature",
    description: "Allow users to import tasks from CSV files",
    priority: "medium" as const,
    status: "in_progress" as const,
  },
  {
    title: "Add real-time collaboration",
    description: "Enable Supabase Realtime for task updates",
    priority: "high" as const,
    status: "todo" as const,
  },
  {
    title: "Build analytics dashboard",
    description: "Create dashboard with charts and metrics",
    priority: "medium" as const,
    status: "todo" as const,
  },
  {
    title: "Implement RAG agent",
    description: "Set up AI agent with tool calling for task management",
    priority: "high" as const,
    status: "in_progress" as const,
  },
  {
    title: "Setup rate limiting",
    description: "Configure Upstash Redis for API rate limiting",
    priority: "medium" as const,
    status: "done" as const,
  },
  {
    title: "Add email notifications",
    description: "Send notifications for task assignments and comments",
    priority: "low" as const,
    status: "todo" as const,
  },
  {
    title: "Write end-to-end tests",
    description: "Add Playwright tests for critical user flows",
    priority: "medium" as const,
    status: "todo" as const,
  },
]

function generateDueDate(): string {
  const now = new Date()
  const daysOffset = Math.floor(Math.random() * 60) - 30 // -30 to +30 days
  const dueDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000)
  return dueDate.toISOString().split("T")[0]
}

async function seedUsers() {
  console.log("🌱 Starting seed process...\n")

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const createdUsers: Array<{ id: string; email: string }> = []

  // Step 1: Create test users
  console.log("📝 Creating test users...")
  for (const user of TEST_USERS) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      })

      if (error) {
        if (error.message.includes("already exists")) {
          console.log(`⚠️  User ${user.email} already exists, skipping creation`)
          // Fetch existing user
          const { data: existingUsers } = await supabase.auth.admin.listUsers()
          const existing = existingUsers?.users.find((u) => u.email === user.email)
          if (existing) {
            createdUsers.push({ id: existing.id, email: user.email })
          }
        } else {
          throw error
        }
      } else {
        console.log(`✓ Created user: ${user.email}`)
        if (data.user) {
          createdUsers.push({ id: data.user.id, email: user.email })
        }
      }
    } catch (err) {
      console.error(`✗ Failed to create user ${user.email}:`, err)
    }
  }

  if (createdUsers.length === 0) {
    console.error("❌ No users were created. Exiting.")
    return
  }

  console.log(`\n✓ Created/verified ${createdUsers.length} users\n`)

  // Step 2: Create profiles
  console.log("👤 Creating user profiles...")
  for (const user of createdUsers) {
    const testUser = TEST_USERS.find((u) => u.email === user.email)
    if (!testUser) continue

    try {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: testUser.fullName,
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )

      if (error) throw error
      console.log(`✓ Created profile for ${testUser.fullName}`)
    } catch (err) {
      console.error(`✗ Failed to create profile for ${user.email}:`, err)
    }
  }

  console.log("")

  // Step 3: Create projects and tasks for each user
  for (const user of createdUsers) {
    const testUser = TEST_USERS.find((u) => u.email === user.email)
    if (!testUser) continue

    console.log(`📦 Creating project for ${testUser.fullName}...`)

    try {
      // Create project
      const projectId = randomUUID()
      const now = new Date()
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      const deliveryDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) // 60 days from now

      const { error: projectError } = await supabase.from("projects").insert({
        id: projectId,
        user_id: user.id,
        name: `${testUser.fullName}'s Project`,
        start_date: startDate.toISOString().split("T")[0],
        delivery_date: deliveryDate.toISOString().split("T")[0],
      })

      if (projectError) throw projectError
      console.log(`  ✓ Created project`)

      // Add user as project owner
      const { error: memberError } = await supabase.from("project_members").insert({
        project_id: projectId,
        user_id: user.id,
        role: "owner",
      })

      if (memberError) throw memberError
      console.log(`  ✓ Added user as project owner`)

      // Create tasks
      console.log(`  📋 Creating sample tasks...`)
      let position = 1000
      const taskIds: string[] = []

      for (let i = 0; i < SAMPLE_TASKS.length; i++) {
        const taskTemplate = SAMPLE_TASKS[i]
        const taskId = randomUUID()
        taskIds.push(taskId)

        const { error: taskError } = await supabase.from("tasks").insert({
          id: taskId,
          user_id: user.id,
          project_id: projectId,
          title: taskTemplate.title,
          description: taskTemplate.description,
          status: taskTemplate.status,
          priority: taskTemplate.priority,
          position: position,
          due_date: generateDueDate(),
        })

        if (taskError) throw taskError
        position += 1000
      }

      console.log(`  ✓ Created ${taskIds.length} sample tasks`)

      // Assign random tasks to other users (if available)
      if (createdUsers.length > 1) {
        const otherUsers = createdUsers.filter((u) => u.id !== user.id)
        const tasksToAssign = taskIds.slice(0, Math.min(3, taskIds.length))

        for (const taskId of tasksToAssign) {
          const randomAssignee = otherUsers[Math.floor(Math.random() * otherUsers.length)]
          const { error: assignError } = await supabase.from("task_assignments").insert({
            task_id: taskId,
            user_id: randomAssignee.id,
          })

          if (assignError) {
            console.warn(`  ⚠️  Failed to assign task: ${assignError.message}`)
          }
        }
        console.log(`  ✓ Assigned tasks to team members`)
      }

      console.log("")
    } catch (err) {
      console.error(`✗ Failed to create project for ${user.email}:`, err)
    }
  }

  // Step 4: Create some shared project (optional)
  if (createdUsers.length >= 2) {
    console.log("🤝 Creating shared project...")
    try {
      const sharedProjectId = randomUUID()
      const now = new Date()
      const startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 14 days ago
      const deliveryDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000) // 45 days from now

      // Create project owned by first user
      const { error: projectError } = await supabase.from("projects").insert({
        id: sharedProjectId,
        user_id: createdUsers[0].id,
        name: "Team Collaboration Project",
        start_date: startDate.toISOString().split("T")[0],
        delivery_date: deliveryDate.toISOString().split("T")[0],
      })

      if (projectError) throw projectError

      // Add all users as members
      for (const user of createdUsers) {
        const role = user.id === createdUsers[0].id ? "owner" : "editor"
        const { error: memberError } = await supabase.from("project_members").insert({
          project_id: sharedProjectId,
          user_id: user.id,
          role: role,
        })

        if (memberError) throw memberError
      }

      console.log(`✓ Created shared project with ${createdUsers.length} members`)

      // Add some tasks to shared project
      let position = 1000
      const sharedTasks = SAMPLE_TASKS.slice(0, 5)

      for (const taskTemplate of sharedTasks) {
        const taskId = randomUUID()
        const { error: taskError } = await supabase.from("tasks").insert({
          id: taskId,
          user_id: createdUsers[0].id, // Created by first user
          project_id: sharedProjectId,
          title: `[SHARED] ${taskTemplate.title}`,
          description: taskTemplate.description,
          status: taskTemplate.status,
          priority: taskTemplate.priority,
          position: position,
          due_date: generateDueDate(),
        })

        if (taskError) throw taskError
        position += 1000

        // Assign to random team member
        const assignee = createdUsers[Math.floor(Math.random() * createdUsers.length)]
        await supabase.from("task_assignments").insert({
          task_id: taskId,
          user_id: assignee.id,
        })
      }

      console.log(`✓ Added 5 shared tasks\n`)
    } catch (err) {
      console.error(`✗ Failed to create shared project:`, err)
    }
  }

  // Summary
  console.log("=".repeat(50))
  console.log("✅ Seed complete!\n")
  console.log("Created users:")
  for (const user of createdUsers) {
    const testUser = TEST_USERS.find((u) => u.email === user.email)
    if (testUser) {
      console.log(`  • ${testUser.email} (${testUser.fullName})`)
    }
  }
  console.log("\nYou can now log in with:")
  console.log(`  Email: ${TEST_USERS[0].email}`)
  console.log(`  Password: ${TEST_USERS[0].password}\n`)
}

seedUsers().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
