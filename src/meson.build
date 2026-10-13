blueprints = custom_target(
  'blueprints',
  input: files(
    'widgets/accountDialog.blp',
    'widgets/accountsDialog.blp',
    'widgets/notificationRow.blp',
    'widgets/preferences.blp',
    'shortcuts-dialog.blp',
    'window.blp',
  ),
  output: '.',
  command: [
    find_program('blueprint-compiler'),
    'batch-compile',
    '@OUTPUT@',
    '@CURRENT_SOURCE_DIR@',
    '@INPUT@',
  ],
)

tsc_out = meson.project_build_root() / 'tsc-out'

typescript = custom_target(
  'typescript-compile',
  build_by_default: true,
  build_always_stale: true,
  command: [tsc, '--project', tsconfig, '--outDir', tsc_out],
  output: ['tsc-output'],
  depends: [npm_ci],
)

src_res = gnome.compile_resources(
  application_id + '.src',
  configure_file(
    input: 'com.mardojai.ForgeSparks.src.gresource.xml.in',
    output: application_id + '.src.gresource.xml',
    configuration: conf,
  ),
  source_dir: tsc_out,
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
  dependencies: [blueprints, typescript],
)

data_res = gnome.compile_resources(
  application_id + '.data',
  configure_file(
    input: 'com.mardojai.ForgeSparks.data.gresource.xml.in',
    output: application_id + '.data.gresource.xml',
    configuration: conf,
  ),
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
  dependencies: [blueprints, typescript],
)

configure_file(
  input: 'com.mardojai.ForgeSparks',
  output: application_id,
  configuration: conf,
  install: true,
  install_dir: pkgdatadir,
)

subdir('icons')
