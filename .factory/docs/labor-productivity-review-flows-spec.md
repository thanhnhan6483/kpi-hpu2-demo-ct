# I. Primer

## 1. TL;DR kiểu Feynman
- Trang danh sách Năng suất lao động trước có 2 nút thủ công "Tổng hợp" và "Kiểm tra" (gộp điểm, thẩm định). Giờ bỏ hẳn 2 nút này, thay bằng 2 link "Quản lý ĐG" và "Hội đồng ĐG".
- Nhấn "Quản lý ĐG" mở đúng trang chi tiết của nhân sự đó nhưng ở góc nhìn trưởng đơn vị; "Hội đồng ĐG" mở ở góc nhìn hội đồng chấm. Hai góc nhìn này dùng giao diện và bố cục giống hệt trang "Cá nhân ĐG" vốn có.
- Quy trình đánh giá giờ là 3 cấp nối tiếp nhau: Cá nhân tự đánh giá → Trưởng đơn vị đánh giá → Hội đồng đánh giá và khóa kết quả.
- Bản ghi đánh giá được tạo tự động khi cá nhân bấm "Lưu kết quả" ở trang Cá nhân ĐG (không cần nút tổng hợp như cũ).
- Mỗi góc nhìn chỉ hiện đúng quyền: trưởng đơn vị thấy form đánh giá riêng, hội đồng thấy form riêng + nút Khóa kết quả, người không có quyền bị chặn.
- Khi trưởng đơn vị hoặc hội đồng mở trang, một card "Kết quả các cấp đánh giá" tổng hợp ngắn gọn điểm/xếp loại/nhận xét của từng cấp ngay đầu trang.

## 2. Elaboration & Self-Explanation
Trước đây data model có khái niệm "tổng hợp" (aggregate): một vài người trong đơn vị bấm nút để gộp kết quả. Flow này thủ công, dễ quên, không phản ánh quy trình thực tế (cá nhân → quản lý → hội đồng).

Thay đổi lần này:
- **Console (trang danh sách)** chỉ còn vai trò "bảng điều khiển": hiển thị điểm từng người, nút đi sâu vào trang chi tiết, và nút "Gửi tự đánh giá" khi bản nháp tồn tại. Nút mở trang "Quản lý ĐG" hiển thị khi người xem có quyền đánh giá (u001 hoặc trưởng đơn vị) và bản ghi đang ở giai đoạn cho phép quản lý đánh giá (đã gửi tự đánh giá trở lên). Nút "Hội đồng ĐG" hiển thị khi người xem là thành viên hội đồng (u001/u002) và bản ghi đạt giai đoạn quản lý đã đánh giá trở lên.
- **Trang chi tiết** trở thành 1 màn hình dùng 3 vai trò, phân biệt qua query param `role` (`self`, `manager`, `council`):
  - Vai trò `self`: như cũ — xem, lưu điểm/xếp loại tự đánh giá.
  - Vai trò `manager`: thấy card tổng hợp 3 cấp, form "Quản lý đánh giá" (điểm điều chỉnh, xếp loại, nhận xét). Lưu sẽ đẩy trạng thái bản ghi thành `manager_reviewed`.
  - Vai trò `council`: thấy card tổng hợp 3 cấp, form "Hội đồng đánh giá" (điểm, xếp loại, nhận xét) kèm nút "Khóa kết quả". Lưu đẩy trạng thái thành `council_reviewed`; khóa đẩy thành `locked` (không ai đổi được nữa).
- **Tạo bản ghi tự động**: khi tự đánh giá mà chưa có bản ghi trong tháng, "Lưu kết quả" sẽ POST tạo bản ghi mới (status mặc định `draft`); nếu đã có thì PUT cập nhật điểm/xếp loại. Như vậy không còn lệ thuộc nút "Tổng hợp".
- **Quyền**: `canManage` (u001 hoặc trưởng đơn vị) cho view `manager`; `canCouncil` (u001/u002) cho view `council`; `canSaveSelf` (chính nhân sự hoặc người quản lý) cho view `self`. Ai vào view không đúng quyền sẽ thấy thông báo chặn và không thấy nội dung.

## 3. Concrete Examples & Analogies
Ví dụ cụ thể: Nhân sự Nguyễn Văn A (u010) thuộc Phòng TC, tháng 8/2026.
1. A mở `/kpi/labor-productivity/u010?month=2026-08` (view self), bấm "Lưu kết quả" 85 điểm "A" → hệ thống tự tạo bản ghi `draft`.
2. Trưởng đơn vị (u005) mở console, thấy A có badge "Đã gửi" (sau khi A gửi) → nút "Quản lý ĐG" hiện ra → vào xem card 3 cấp và điền nhận xét, bấm "Lưu nhận xét" → bản ghi thành `manager_reviewed`.
3. Thành viên Hội đồng (u001) giờ thấy nút "Hội đồng ĐG" → vào xem điểm cả 3 cấp, ghi nhận xét hội đồng, bấm "Khóa kết quả" → bản ghi thành `locked`, A không sửa được nữa.

Analogy: giống quy trình xét duyệt đơn — nhân viên tự điền đơn (draft), bấm gửi, trưởng phòng duyệt (manager_reviewed), rồi ban giám đốc phê chuẩn cuối cùng (locked). Đơn được tạo ngay khi nhân viên lưu, không cần ai "gộp" giấy tờ thủ công.

```
flowchart LR
    A[Nhân sự tự ĐG<br/>Lưu kết quả → tạo bản ghi draft] --> B[Gửi tự đánh giá<br/>console → self_reviewed]
    B --> C[Trưởng đơn vị<br/>Quản lý ĐG → manager_reviewed]
    C --> D[Hội đồng<br/>Hội đồng ĐG → council_reviewed]
    D --> E[Khóa kết quả → locked]
```

# II. Audit Summary (Tóm tắt kiểm tra)
- Root cause theo cách "Evidence over Opinion":
  - Observation: console có nút "Tổng hợp" (`handleAggregate`) và nút "Kiểm tra" (`handleManagerReview`/`handleCouncilSubmit`) đã lỗi thời với luồng đánh giá thực tế; UX yêu cầu bỏ.
  - Evidence: `src/app/kpi/labor-productivity/page.tsx` trước khi sửa có `handleAggregate`, `handleManagerReview`, `handleCouncilSubmit`, state `review`, `ReviewModal`, imports `Modal`/`Lock`/`apiPost`/`ProductivityCriterionRow`. API `POST /api/labor-productivity` và `PUT /api/labor-productivity/:id` đã hỗ trợ sẵn tạo/update theo `userId + month + academicYearId`, không cần thêm bất kỳ endpoint nào.
  - Phạm vi ảnh hưởng: trang console + trang chi tiết `[userId]`; không đổi schema, không đổi DB, không đổi API.
- Sau sửa: console sạch nút tổng hợp/kiểm tra; detail page dùng chung 1 route cho 3 role.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- Root cause chính ở đây không phải bug mà là design lệch quy trình: merge/aggregate tốn thao tác thủ công, và màn "Kiểm tra" không phản ánh đúng 3 cấp đánh giá (Cá nhân → Quản lý → Hội đồng).
- Counter-hypothesis đã loại trừ:
  - "Cần tạo route/trang riêng cho Quản lý và Hội đồng" → Bác bỏ: dùng chung route + query `?role=` (đã thống nhất với user, chi phí thấp hơn, giữ UI nhất quán).
  - "Vẫn cần nút Tổng hợp để tạo bản ghi" → Bác bỏ: bản ghi tự tạo tại thời điểm cá nhân "Lưu kết quả" (POST upsert, status `draft`), quyết định này đã được user chọn.

# IV. Proposal (Đề xuất)
1. Console (`page.tsx`):
   - Xóa `handleAggregate`, bỏ cả hai nút "Tổng hợp" và "Kiểm tra".
   - Xóa `ReviewModal` + handler `handleManagerReview`/`handleCouncilSubmit` + state `review`.
   - Thêm 2 Link điều hướng:
     - "Quản lý ĐG" → `?role=manager&month=...`, hiện khi `canReview && rec && ['self_reviewed','manager_reviewed','council_reviewed','locked'].includes(rec.status)`.
     - "Hội đồng ĐG" → `?role=council&month=...`, hiện khi `canCouncil && rec && ['manager_reviewed','council_reviewed','locked'].includes(rec.status)`.
   - Badge trạng thái khi chưa có bản ghi đổi từ "Chưa tổng hợp" → "Chưa gửi".
2. Detail page (`[userId]/page.tsx`):
   - Đọc `role` từ `searchParams` (mặc định `self`).
   - Quyền: `canCouncil` (u001/u002), `canSaveSelf` (chính mình hoặc `canManage`); guard IIFE chặn view không đúng quyền.
   - Title theo role: "Cá nhân ĐG" / "Quản lý ĐG" / "Hội đồng ĐG".
   - Với `role !== 'self'`: hiển thị card "Kết quả các cấp đánh giá" (Tự ĐG / Quản lý / Hội đồng: điểm, badge xếp loại, nhận xét).
   - Form theo role:
     - self: `canSaveSelf && (!rec || rec.status !== 'locked')`; `handleSaveSelf` POST tạo bản ghi khi `!rec`, PUT khi có `rec`.
     - manager: form "Quản lý đánh giá" → "Lưu nhận xét" → PUT `{status:'manager_reviewed', managerNote, managerGrade, managerScore?, reviewedAt}`.
     - council: form "Hội đồng đánh giá" → "Lưu nhận xét" → PUT `{status:'council_reviewed', ...}` và "Khóa kết quả" → PUT `{status:'locked', lockedAt}` (+ `councilReviewedAt`, `councilReviewedBy`).
   - Chuyển month selector kèm theo `&role=...` để không mất role khi đổi tháng.
3. Không đổi schema, không đổi API, không đổi quy tắc tự tính điểm `computeSelfScore`.

# V. Files Impacted (Tệp bị ảnh hưởng)
- `Sửa:` `src/app/kpi/labor-productivity/page.tsx` — console giữ vai trò điều phối; bỏ nút Tổng hợp/Kiểm tra + ReviewModal, thêm 2 link "Quản lý ĐG"/"Hội đồng ĐG", đổi badge "Chưa gửi".
- `Sửa:` `src/app/kpi/labor-productivity/[userId]/page.tsx` — trang chi tiết dùng chung 3 role; thêm card tổng hợp 3 cấp, form quản lý/hội đồng, POST tạo bản ghi khi tự đánh giá, guard quyền.
- `Thêm:` `.factory/docs/labor-productivity-review-flows-spec.md` — spec của task này.

# VI. Execution Preview (Xem trước thực thi)
1. Console: xóa handler/state/modal cũ; thay 2 nút by action bằng 2 Link theo `?role=`; dọn import thừa (bỏ `Modal`, `Lock`, `apiPost`, `ProductivityCriterionRow`); giữ `managerCell/councilCell/finalScore/finalGrade/isOwnerSubmit`.
2. Detail page: thêm `role`, `canCouncil`, `canSaveSelf`; states `noteText/revScore/revGrade`; effect sync theo `rec/mặt month/role`; `parseScore`, `gradeOf`, `handleSaveSelf` (POST khi `!rec`), `handleManagerSave`, `handleCouncilSave(lock)`.
3. Guard IIFE theo role; card "Kết quả các cấp đánh giá" = 3 hàng chia ngăn.
4. Form 3 role thay thế 1 form cũ (điều kiện hiển thị khác nhau).
5. Verify: `npx tsc --noEmit` sạch (chỉ 2 lỗi pre-existing `IndividualPlan.items`); grep không còn `handleAggregate/ReviewModal/setReview/Modal`.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Typecheck: `npx tsc --noEmit 2>&1 | Select-Object -First 10` chỉ còn 2 lỗi pre-existing đã biết:
  - `src/app/api/individual-plans/route.ts(28,5)`
  - `src/app/kpi/my-kpi/page.tsx(85,32)`
- Grep: không còn `handleAggregate`, `ReviewModal`, `setReview`, nhãn "Kiểm tra"/"Tổng hợp" dạng button.
- Integration (tester phụ trách — theo AGENTS.md agent không tự chạy runtime):
  - u001 gửi tự đánh giá → bản ghi xuất hiện, nút "Quản lý ĐG" hiện với quản lý.
  - Quản lý mở `?role=manager` → thấy card 3 cấp + form, lưu → badge "Đã đánh giá" (manager_reviewed), nút "Hội đồng ĐG" hiện.
  - Hội đồng mở `?role=council` → thấy card 3 cấp (kèm điểm quản lý) + form, "Khóa kết quả" → badge "Đã khóa", trang tự ĐG không cho sửa tiếp.
  - Người không có quyền mở `?role=manager`/`?role=council` → bị chặn.
  - Đổi tháng trên view manager/council → giữ nguyên `role`.

# VIII. Todo
- [x] Console: xóa `handleAggregate`, 2 nút Tổng hợp/Kiểm tra, `ReviewModal` + handlers + imports thừa.
- [x] Console: thêm 2 Link "Quản lý ĐG"/"Hội đồng ĐG" theo điều kiện giai đoạn + quyền.
- [x] Console: badge "Chưa gửi" thay "Chưa tổng hợp".
- [x] Detail: `role`, `canCouncil`, `canSaveSelf`, title theo role, guard quyền, month selector giữ role.
- [x] Detail: card "Kết quả các cấp đánh giá" (role khác self).
- [x] Detail: form self POST tạo bản ghi khi chưa có.
- [x] Detail: form manager → `manager_reviewed`.
- [x] Detail: form council + "Khóa kết quả" → `council_reviewed` / `locked`.
- [x] Verify: tsc + grep sạch.
- [x] Ghi spec `.factory/docs/labor-productivity-review-flows-spec.md`.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Console không còn nút "Tổng hợp" và "Kiểm tra"; chỉ còn "Cá nhân ĐG", "Gửi tự đánh giá" (khi draft & đúng chủ sở hữu), "Quản lý ĐG", "Hội đồng ĐG".
- "Quản lý ĐG"/"Hội đồng ĐG" chỉ hiện khi đúng giai đoạn và đúng quyền (điều kiện ở Proposal).
- Detail page render đúng giao diện theo role; card "Kết quả các cấp đánh giá" hiện đúng cho manager/council.
- Lưu tự đánh giá khi chưa có bản ghi → tạo bản ghi thành công (POST), badge sang trạng thái tương ứng.
- "Khóa kết quả" đặt `status=locked`; sau khóa form tự ĐG không còn hiện.
- `npx tsc --noEmit` chỉ còn đúng 2 lỗi pre-existing.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Risk: bỏ nút "Tổng hợp" mà ai đó vẫn dùng quy trình cũ → hành vi chuyển sang tự tạo bản ghi khi lưu; cần thông báo. Nếu bản ghi đã tồn tại thì PUT, không tạo trùng (upsert theo `userId+month+academicYearId`).
- Risk: view council trước khi manager đánh giá có thể hiện card trống cấp Quản lý → đã xử bằng chữ "Chưa đánh giá".
- Rollback: revert commit; console và detail page trở về trạng thái trước (nút cũ vận hành lại như cũ, vì chỉ đổi UI không đổi schema/API).

# XI. Out of Scope (Ngoài phạm vi)
- Không đổi schema, không thêm table, không thêm API mới.
- Không cải tiến thuật toán tính điểm tự động (`computeSelfScore`), không đổi seed dữ liệu.
- Không làm tính năng "giả lập vai trò" hay phân quyền server-side cho API.
- Không đổi luồng đồng bộ dữ liệu (`/api/unit-work-plans/sync-month`).