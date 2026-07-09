import { jest } from "@jest/globals";
import { showAddedOrderToasts } from "@/pages/group/GroupDetail/toastUtils";

describe("showAddedOrderToasts", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires one toast per ordered item", () => {
    const showToast = jest.fn();

    showAddedOrderToasts(
      [
        { item: { name: "枝豆" }, qty: 2 },
        { item: { name: "唐揚げ" }, qty: 1 },
      ],
      (name) => `${name} を追加しました`,
      showToast,
    );

    jest.runAllTimers();

    expect(showToast).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenNthCalledWith(1, "枝豆 ×2 を追加しました");
    expect(showToast).toHaveBeenNthCalledWith(2, "唐揚げ ×1 を追加しました");
  });

  it("staggers each toast so they do not appear simultaneously", () => {
    const showToast = jest.fn();

    showAddedOrderToasts(
      [
        { item: { name: "枝豆" }, qty: 2 },
        { item: { name: "唐揚げ" }, qty: 1 },
      ],
      (name) => `${name} を追加しました`,
      showToast,
    );

    jest.advanceTimersByTime(0);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenNthCalledWith(1, "枝豆 ×2 を追加しました");

    jest.advanceTimersByTime(150);
    expect(showToast).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenNthCalledWith(2, "唐揚げ ×1 を追加しました");
  });
});
