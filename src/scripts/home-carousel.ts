const carousel = document.querySelector<HTMLElement>("[data-carousel]");
if (carousel) {
	const slides = Array.from(carousel.querySelectorAll<HTMLElement>(".carousel-slide"));
	const dots = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-carousel-dot]"));
	const prev = document.querySelector<HTMLButtonElement>("[data-carousel-prev]");
	const next = document.querySelector<HTMLButtonElement>("[data-carousel-next]");

	const setActive = (idx: number) => {
		dots.forEach((d, i) => d.toggleAttribute("data-active", i === idx));
	};

	const scrollTo = (idx: number) => {
		const target = slides[Math.max(0, Math.min(slides.length - 1, idx))];
		if (!target) return;
		carousel.scrollTo({ left: target.offsetLeft - carousel.offsetLeft, behavior: "smooth" });
	};

	const indexFromScroll = () => {
		const center = carousel.scrollLeft + carousel.clientWidth / 2;
		let best = 0;
		let bestDist = Infinity;
		slides.forEach((s, i) => {
			const slideCenter = s.offsetLeft - carousel.offsetLeft + s.offsetWidth / 2;
			const d = Math.abs(slideCenter - center);
			if (d < bestDist) {
				bestDist = d;
				best = i;
			}
		});
		return best;
	};

	carousel.addEventListener("scroll", () => setActive(indexFromScroll()), { passive: true });
	dots.forEach((d, i) => d.addEventListener("click", () => scrollTo(i)));
	prev?.addEventListener("click", () => scrollTo(indexFromScroll() - 1));
	next?.addEventListener("click", () => scrollTo(indexFromScroll() + 1));

	setActive(0);
}
