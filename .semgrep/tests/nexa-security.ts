// Semgrep CE local rule regression fixtures. Never import or execute this file.
import { exec, execSync, spawn } from "node:child_process";

declare const untrustedCode: string;
declare const command: string;

function dynamicCodeExecution(): void {
  // ruleid: nexa.security.no-dynamic-eval
  eval(untrustedCode);

  // ruleid: nexa.security.no-dynamic-eval
  const created = new Function(untrustedCode);
  void created;

  const redis = { eval(_script: string): number { return 1; } };
  // ok: nexa.security.no-dynamic-eval
  redis.eval("return 1");
}

function shellExecution(): void {
  // ruleid: nexa.security.no-shell-exec
  exec(command);

  // ruleid: nexa.security.no-shell-exec
  execSync(command);

  // ok: nexa.security.no-shell-exec
  spawn("git", ["status"], { shell: false });
}

function tlsConfig(): void {
  const insecureAgent = {
    // ruleid: nexa.security.tls-certificate-verification
    rejectUnauthorized: false,
  };
  const strictAgent = {
    // ok: nexa.security.tls-certificate-verification
    rejectUnauthorized: true,
  };
  void insecureAgent;
  void strictAgent;
}

void dynamicCodeExecution;
void shellExecution;
void tlsConfig;
