import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PROJECT_ID = "283a0e26-21ab-45b6-9028-c0440a76a6f7";

// IDs existentes (se conservan para no romper el historial de tareas)
const EXISTING = {
  owner: "38bd6ec2-28e8-4f52-86c7-e7e2a61bd94c", // mcoyllmdata@gmail.com (login real, invitado)
  demo1: "d9d36f55-c29e-4ac8-85c6-f0c71ad0d9ca", // -> Data Analyst
  demo2: "cda4d105-c495-4f6f-a567-ae89c3f98923", // -> Data Engineer
};

type Role =
  | "Data Engineer"
  | "ML Engineer"
  | "Data Analyst"
  | "Business Analyst"
  | "Scrum Master";

async function main() {
  console.log("🌱 Configurando equipo real del proyecto Olist (Sodimac · Mercadeo)\n");

  // ── 1. Metadata de empresa/área en el proyecto ──────────────────────────
  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({ company: "Sodimac", department: "Mercadeo" })
    .eq("id", PROJECT_ID);

  if (projectUpdateError) throw projectUpdateError;
  console.log("✅ Proyecto actualizado: company=Sodimac, department=Mercadeo\n");

  // ── 2. Renombrar cuentas existentes (mismo UUID, nuevo email/nombre) ────
  console.log("👤 Renombrando cuentas existentes...");

  await supabase.auth.admin.updateUserById(EXISTING.demo2, {
    email: "lpichon@sodimac.com.co",
  });
  await supabase
    .from("profiles")
    .update({ full_name: "Laura Pichón" })
    .eq("id", EXISTING.demo2);
  console.log("  ✓ demo2 -> Laura Pichón <lpichon@sodimac.com.co> (Data Engineer)");

  await supabase.auth.admin.updateUserById(EXISTING.demo1, {
    email: "jgamboa@sodimac.com.co",
  });
  await supabase
    .from("profiles")
    .update({ full_name: "Jorge Gamboa" })
    .eq("id", EXISTING.demo1);
  console.log("  ✓ demo1 -> Jorge Gamboa <jgamboa@sodimac.com.co> (Data Analyst)");

  await supabase
    .from("profiles")
    .update({ full_name: "María Coy" })
    .eq("id", EXISTING.owner);
  console.log("  ✓ owner  -> María Coy <mcoyllmdata@gmail.com> (Machine Learning, Project Owner)\n");

  // ── 3. Crear las 2 cuentas faltantes: Business Analyst y Scrum Master ──
  console.log("👥 Creando cuentas nuevas...");

  const newUsers: Record<string, string> = {};

  const { data: baUser, error: baError } = await supabase.auth.admin.createUser({
    email: "cmendez@sodimac.com.co",
    password: "Sodimac2026!",
    email_confirm: true,
    user_metadata: { full_name: "Carolina Méndez" },
  });
  if (baError) throw baError;
  newUsers.businessAnalyst = baUser.user!.id;
  console.log("  ✓ Carolina Méndez <cmendez@sodimac.com.co> (Business Analyst)");

  const { data: smUser, error: smError } = await supabase.auth.admin.createUser({
    email: "atorres@sodimac.com.co",
    password: "Sodimac2026!",
    email_confirm: true,
    user_metadata: { full_name: "Andrés Torres" },
  });
  if (smError) throw smError;
  newUsers.scrumMaster = smUser.user!.id;
  console.log("  ✓ Andrés Torres <atorres@sodimac.com.co> (Scrum Master)\n");

  // profiles se crean automáticamente por el trigger handle_new_user()

  // ── 4. Agregarlos como miembros del proyecto ────────────────────────────
  const { error: membersError } = await supabase.from("project_members").insert([
    { project_id: PROJECT_ID, user_id: newUsers.businessAnalyst, role: "editor" },
    { project_id: PROJECT_ID, user_id: newUsers.scrumMaster, role: "editor" },
  ]);
  if (membersError) throw membersError;
  console.log("✅ Nuevos miembros agregados al proyecto\n");

  // ── 5. Mapeo final de rol -> user_id ─────────────────────────────────────
  const roleToUser: Record<Role, string> = {
    "Data Engineer": EXISTING.demo2,
    "ML Engineer": EXISTING.owner,
    "Data Analyst": EXISTING.demo1,
    "Business Analyst": newUsers.businessAnalyst,
    "Scrum Master": newUsers.scrumMaster,
  };

  // ── 6. Reasignar las 60 tareas: user_id + task_assignments ──────────────
  console.log("📝 Reasignando tareas por rol...");

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, description")
    .eq("project_id", PROJECT_ID);

  if (tasksError) throw tasksError;
  if (!tasks?.length) throw new Error("No se encontraron tareas del proyecto Olist");

  let reassigned = 0;
  let assignmentsCreated = 0;

  for (const task of tasks) {
    const match = task.description?.match(/^\[([^\]]+)\]/);
    const role = match?.[1] as Role | undefined;

    if (!role || !roleToUser[role]) {
      console.warn(`  ⚠ No se pudo determinar el rol de la tarea ${task.id}, se omite`);
      continue;
    }

    const userId = roleToUser[role];

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ user_id: userId })
      .eq("id", task.id);

    if (updateError) {
      console.error(`  ✗ Error actualizando tarea ${task.id}:`, updateError);
      continue;
    }
    reassigned++;

    // Limpiar asignaciones previas (por si el script se corre 2 veces) y crear la correcta
    await supabase.from("task_assignments").delete().eq("task_id", task.id);
    const { error: assignError } = await supabase
      .from("task_assignments")
      .insert({ task_id: task.id, user_id: userId });

    if (assignError) {
      console.error(`  ✗ Error creando assignment para ${task.id}:`, assignError);
      continue;
    }
    assignmentsCreated++;
  }

  console.log(`\n✅ ${reassigned}/${tasks.length} tareas reasignadas`);
  console.log(`✅ ${assignmentsCreated}/${tasks.length} task_assignments creados\n`);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("✅ EQUIPO OLIST · SODIMAC · MERCADEO");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🛠️  Data Engineer     Laura Pichón     lpichon@sodimac.com.co");
  console.log("🤖 ML Engineer       María Coy        mcoyllmdata@gmail.com  (owner)");
  console.log("📊 Data Analyst      Jorge Gamboa     jgamboa@sodimac.com.co");
  console.log("💼 Business Analyst  Carolina Méndez  cmendez@sodimac.com.co");
  console.log("🏃 Scrum Master      Andrés Torres    atorres@sodimac.com.co");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔑 Password nuevas cuentas: Sodimac2026!");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("❌ Error en el proceso:", err);
  process.exit(1);
});
