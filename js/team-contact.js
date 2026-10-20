const contactButton = document.getElementById("btn-say-hello");
const contactModal = document.getElementById("contact-modal");
const contactClose = document.getElementById("contact-modal-close");
const contactForm = document.getElementById("contact-form");

function closeContactModal() {
  if (contactModal?.open) contactModal.close();
}

contactButton?.addEventListener("click", () => contactModal?.showModal());
contactClose?.addEventListener("click", closeContactModal);

contactModal?.addEventListener("click", (event) => {
  if (event.target === contactModal) closeContactModal();
});

contactModal?.addEventListener("close", () => contactButton?.focus());

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(contactForm);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const body = [`From: ${name}`, `Reply email: ${email}`, "", message].join("\n");
  const mailto = new URL("mailto:campusvolts@gmail.com");

  mailto.searchParams.set("subject", subject);
  mailto.searchParams.set("body", body);
  window.location.href = mailto.toString();
});
