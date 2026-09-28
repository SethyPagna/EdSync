import { afterEach, describe, expect, it, vi } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { putR2Object } from "./r2";

const mocks = vi.hoisted(() => ({ put: vi.fn(), send: vi.fn() }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: vi.fn() }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function S3ClientMock() { return { send: mocks.send }; }),
  PutObjectCommand: vi.fn(function PutObjectCommandMock(input: unknown) { return input; }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("R2 uploads", () => {
  it("uses the Worker binding without S3 credentials", async () => {
    vi.stubEnv("R2_BUCKET", "edsync-assets-prod");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://assets.example.test/");
    vi.mocked(getCloudflareContext).mockReturnValue({ env: { EDSYNC_ASSETS: { put: mocks.put } } } as unknown as ReturnType<typeof getCloudflareContext>);

    const result = await putR2Object({ key: "lesson/image.png", body: Buffer.from("image"), contentType: "image/png" });

    expect(mocks.put).toHaveBeenCalledWith("lesson/image.png", new Uint8Array(Buffer.from("image")), {
      httpMetadata: { contentType: "image/png" },
    });
    expect(S3Client).not.toHaveBeenCalled();
    expect(result.publicUrl).toBe("https://assets.example.test/lesson/image.png");
  });

  it("keeps the S3 path for a host without Worker bindings", async () => {
    vi.stubEnv("R2_BUCKET", "edsync-assets-prod");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-1");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-1");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-1");
    vi.mocked(getCloudflareContext).mockImplementation(() => { throw new Error("No Worker context"); });

    await putR2Object({ key: "lesson/image.png", body: Buffer.from("image") });

    expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({ Bucket: "edsync-assets-prod", Key: "lesson/image.png" }));
    expect(mocks.send).toHaveBeenCalledOnce();
  });
});
