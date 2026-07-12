import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PROJECT_ID = "283a0e26-21ab-45b6-9028-c0440a76a6f7";

const EXISTING = {
  owner: "38bd6ec2-28e8-4f52-86c7-e7e2a61bd94c", // María Coy - ML Engineer (owner)
  demo1: "d9d36f55-c29e-4ac8-85c6-f0c71ad0d9ca", // Jorge Gamboa - Data Analyst
  demo2: "cda4d105-c495-4f6f-a567-ae89c3f98923", // Laura Pichón - Data Engineer
};

type Role =
  | "Data Engineer"
  | "ML Engineer"
  | "Data Analyst"
  | "Business Analyst"
  | "Scrum Master";

async function main() {
  // Resolver los IDs de las 2 cuentas nuevas por email (creadas en el paso anterior)
  const { data: baList } = await supabase.auth.admin.listUsers();
  const ba = baList.users.find((u) => u.email === "cmendez@sodimac.com.co");
  const sm = baList.users.find((u) => u.email === "atorres@sodimac.com.co");

  if (!ba || !sm) throw new Error("No se encontraron las cuentas de Business Analyst / Scrum Master");

  const roleToUser: Record<Role, string> = {
    "Data Engineer": EXISTING.demo2,
    "ML Engineer": EXISTING.owner,
    "Data Analyst": EXISTING.demo1,
    "Business Analyst": ba.id,
    "Scrum Master": sm.id,
  };

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, description")
    .eq("project_id", PROJECT_ID);

  if (error) throw error;
  if (!tasks?.length) throw new Error("No se encontraron tareas");

  let fixed = 0;

  for (const task of tasks) {
    const match = task.description?.match(/^\[([^\]]+)\]/);
    const role = match?.[1] as Role | undefined;
    if (!role || !roleToUser[role]) {
      console.warn(`⚠ Rol desconocido en tarea ${task.id}`);
      continue;
    }

    const userId = roleToUser[role];

    // Idempotente: limpia asignaciones previas y crea la correcta
    await supabase.from("task_assignments").delete().eq("task_id", task.id);
    const { error: insertError } = await supabase
      .from("task_assignments")
      .insert({ task_id: task.id, user_id: userId });

    if (insertError) {
      console.error(`✗ Error asignando tarea ${task.id} (${role}):`, insertError);
      continue;
    }
    fixed++;
  }

  console.log(`\n✅ ${fixed}/${tasks.length} task_assignments corregidos (fuente de verdad para avatares/filtros)\n`);

  // Verificación final por rol
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    const match = task.description?.match(/^\[([^\]]+)\]/);
    const role = match?.[1] ?? "unknown";
    counts[role] = (counts[role] ?? 0) + 1;
  }
  console.log("📊 Distribución de tareas por rol:");
  for (const [role, count] of Object.entries(counts)) {
    console.log(`   ${role}: ${count}`);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
