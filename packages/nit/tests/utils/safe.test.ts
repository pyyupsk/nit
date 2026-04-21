import { describe, expect, it } from "vitest"
import { safe } from "../../src/utils/safe"

describe("safe", () => {
  it("returns [null, value] on a resolved promise", async () => {
    const [err, value] = await safe(Promise.resolve(42))

    expect(err).toBeNull()
    expect(value).toBe(42)
  })

  it("returns [Error, null] on a rejected promise with an Error", async () => {
    const cause = new Error("boom")
    const [err, value] = await safe(Promise.reject(cause))

    expect(err).toBe(cause)
    expect(value).toBeNull()
  })

  it("wraps a non-Error rejection into an Error", async () => {
    const [err, value] = await safe(Promise.reject("string rejection")) // NOSONAR

    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toBe("string rejection")
    expect(value).toBeNull()
  })

  it("wraps a numeric rejection into an Error", async () => {
    const [err, value] = await safe(Promise.reject(404)) // NOSONAR

    expect(err).toBeInstanceOf(Error)
    expect(err?.message).toBe("404")
    expect(value).toBeNull()
  })

  it("preserves the resolved value type", async () => {
    const [err, value] = await safe(Promise.resolve({ id: 1, name: "nit" }))

    expect(err).toBeNull()
    expect(value?.name).toBe("nit")
  })
})
