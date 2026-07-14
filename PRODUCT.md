# Product

## Register

product

## Users

Recepcionistas de Vía Nova — staff en mostrador que operan el panel durante el turno. Tarea principal: ver y gestionar reservas en la grilla del día, cobrar, crear/editar reservas. Acceso eventual del dueño/manager para configuración y eventos.

## Product Purpose

Panel de administración interno para el complejo deportivo Vía Nova. Gestión operativa de canchas, reservas, clientes, empleados, torneos/eventos y configuración. El éxito es velocidad: cero fricción en las tareas del día a día.

## Brand Personality

Eficiente, claro, confiable. El panel no compite con el negocio — lo sirve. Identidad visual heredada del sitio público: verde oscuro (#0C2820 sidebar, #133D34 activo), crema (#C6B997) como acento cálido, blanco limpio en superficies.

## Anti-references

- SaaS genérico tipo Notion: minimalismo aséptico con grises uniformes y cero identidad de marca
- Dashboard de métricas recargado: widgets, KPIs grandes, gráficos en grid
- App mobile disfrazada de web: cards oversized, demasiado padding para desktop
- ERP/sistema legacy: tablas densas sin aire, colores institucionales

## Design Principles

1. **Velocidad operativa primero** — cada acción crítica debe alcanzarse en ≤2 clics desde cualquier sección
2. **Consistencia con el sistema existente** — reutilizar tokens, componentes y patrones ya establecidos en el panel
3. **Densidad apropiada** — admin opera en desktop; no inflar padding para simular modernidad
4. **Status siempre visible** — estados (activo/cancelado/finalizado) deben leerse sin hover
5. **Cero sorpresas** — acciones destructivas (cancelar evento) requieren confirmación explícita

## Accessibility & Inclusion

WCAG 2.1 AA. Contraste mínimo 4.5:1 en texto. Navegación por teclado en modales y formularios. Sin animaciones bloqueantes; `prefers-reduced-motion` respetado.
