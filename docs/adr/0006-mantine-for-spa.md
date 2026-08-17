# Mantine for the SPA

Staff queues, forms, and dashboards share one component library. We use Mantine (`@mantine/core` and `@mantine/hooks`) with the default light color scheme and no custom palette. Park UI and hand-rolled component CSS were rejected because they would force us to rebuild inputs, buttons, and layout primitives and split styling across ad-hoc sheets. Extra Mantine packages (forms, charts, notifications) stay out until a screen needs them.
