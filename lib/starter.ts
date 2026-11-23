/** La plantilla con la que arranca una nueva: ya muestra cómo usar las variables. */
export const STARTER_TEMPLATE = {
  name: "Novedades del mes",
  subject: "{{firstName}}, esto es nuevo en {{organization}}",
  html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#14212b">
  <h1 style="font-size:22px">¡Hola, {{default firstName "qué tal"}}!</h1>
  <p>Te escribimos desde <strong>{{organization}}</strong> para contarte las novedades de este mes.</p>
  <p>
    <a href="https://ejemplo.com/novedades"
       style="display:inline-block;background:#1f3c88;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">
      Ver las novedades
    </a>
  </p>
  <p style="color:#5b6875">Gracias por estar del otro lado.</p>
</div>`,
};
