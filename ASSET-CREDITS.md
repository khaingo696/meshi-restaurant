# Nguồn asset của mockup

## wash.webp — nền section "O nás" (bản tối, giữ làm dự phòng)
- **Tác phẩm:** *Shōrin-zu byōbu* (松林図屏風, "Tùng lâm đồ bình phong"), Hasegawa Tōhaku (長谷川等伯, 1539–1610)
- **Hiện vật:** Quốc bảo Nhật Bản, Bảo tàng Quốc gia Tokyo
- **Giấy phép:** Public domain (tác giả mất 1610)
- **Nguồn:** Wikimedia Commons — `File:Hasegawa Tohaku, Pine Trees - low resolution.jpg`
- **Đã xử lý:** cắt bỏ khung sơn mài + viền gấm, chuyển duotone sang tông nâu
  (mực `#1d1208` → giấy `#8a6038`) cho khớp bảng màu của web.

## pines-mist.webp — nền Signatures
- **Tác phẩm:** *Shōrin-zu byōbu* cánh phải, Hasegawa Tōhaku — cùng bình phong với wash.webp (cánh trái, nền O nás)
- **Giấy phép:** Public domain
- **Tạo từ:** paper-pines.webp (bên dưới). Xóa 5 đường bản lề đen của bình phong
  và viền trên/dưới, nhuộm lại đúng dải của wash.webp (mực `#1d1208` → giấy `#8a6038`),
  để cuộn từ O nás xuống Signatures là đi tiếp dọc một bức bình phong.
- `silk-mountains.webp` (nền cũ của Signatures, giấy phép chưa xác minh) không còn dùng.

## paper-pines.webp — nguồn của pines-mist.webp
- **Tác phẩm:** *Shōrin-zu byōbu* cánh phải, Hasegawa Tōhaku
- **Giấy phép:** Public domain
- **Nguồn:** Wikimedia Commons — `File:Hasegawa Tohaku - Pine Trees (Shōrin-zu byōbu) - right hand screen.jpg`
- Cùng bộ với wash.webp. Bản scan bảo tàng là giấy kem — đã nhuộm duotone
  (mực `#1c1208` → giấy `#c4a06a`) cho khớp O nás. Cánh phải thoáng hơn,
  để chỗ cho đĩa.

## paper-plum.webp — nền Poukaz
- **Tác phẩm:** *Kōhakubai-zu* (紅白梅図), Ogata Kōrin (1658–1716)
- **Giấy phép:** Public domain
- **Nguồn:** Wikimedia Commons — `File:Ogata Korin - RED AND WHITE PLUM BLOSSOMS (National Treasure) - Google Art Project.jpg`

## silk-mountains.webp — nền Signatures
- **Nguồn:** `public/assets/background/852708392_…_n.jpg` (tranh sơn thủy lụa nâu)
- **Đã xử lý:** cắt viền khung + mép phải (bỏ dấu ✦ watermark), thu về 2200px.
  CSS phủ blur + lớp màn cùng tông ảnh (giống Poukaz).
- Nguồn gốc / giấy phép: chưa xác minh — cần kiểm tra trước khi bàn giao.

## sesshu-winter.webp — nền Rezervace
- **Tác phẩm:** *Shūtō Sansui-zu* (秋冬山水図), bức "Mùa đông", Sesshū Tōyō (雪舟等楊, 1420–1506)
- **Hiện vật:** Quốc bảo Nhật Bản, Bảo tàng Quốc gia Tokyo
- **Giấy phép:** Public domain (tác giả mất 1506)
- **Nguồn:** Wikimedia Commons — `File:SesshuShuutouTou.jpg` (bản thu nhỏ 1920px)
- **Đã xử lý:** cắt bỏ khung gấm và phần trên có chữ ký + triện, thu về 1400px,
  duotone (mực `#1c1208` → giấy `#c4a06a`, cùng dải với paper-pines).
  CSS hạ sáng + phủ lớp tối, không blur.

- `res.webp` (nền cũ, tranh mái nhà + Phú Sĩ) không còn dùng; nguồn gốc chưa rõ và có dấu watermark.

## paper-mist.webp
Không dùng trên web. Sesshū *Haboku Sansui*, public domain, giữ khi cần.

## grain.png — lớp hạt phủ toàn trang
- **Nguồn gốc:** ảnh chụp giấy cũ, public domain — Wikimedia Commons `File:Old paper2.jpg`
- **Đã xử lý:** cắt 1024px → thu về 256px, tách tần số cao để chỉ còn hạt,
  ghép gương 4 chiều thành ô lặp liền mạch 512px.

Các file trên KHÔNG lấy từ trang của designer.
