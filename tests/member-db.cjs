// 별도 PostgreSQL 컨테이너에서만 실행한다. 운영 DB 접속 문자열을 사용하지 않는다.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const container = process.env.HRCOACH_TEST_CONTAINER || "hrcoach-members-qa";
if (!/^hrcoach-members-qa(?:-[a-z0-9]+)?$/.test(container))
  throw new Error("Isolated QA container required");
function sql(text) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: text, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}
try {
  sql(fs.readFileSync("tests/sql/member-bootstrap.sql", "utf8"));
  sql(fs.readFileSync("supabase/subscriptions.sql", "utf8"));
  sql(
    fs.readFileSync(
      "supabase/migrations/20260602_lockdown_subscriptions.sql",
      "utf8",
    ),
  );
  sql(
    fs.readFileSync(
      "supabase/migrations/20260823_billing_recurring.sql",
      "utf8",
    ),
  );
  sql("grant all on public.subscriptions to service_role;");
  for (const f of [
    "20261031_member_management.sql",
    "20261031_billing_attempts.sql",
    "20261031_free_grant_renewal_retry.sql",
  ])
    sql(fs.readFileSync("supabase/migrations/" + f, "utf8"));
  sql(fs.readFileSync("tests/sql/member-management.sql", "utf8"));
  console.log("Member DB integration: passed");
} catch (e) {
  console.error(e.stderr?.toString() || e.message);
  process.exitCode = 1;
}
