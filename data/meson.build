desktop_file = i18n.merge_file(
  input: configure_file(
    input: 'com.mardojai.ForgeSparks.desktop.in.in',
    output: 'com.mardojai.ForgeSparks.desktop.in',
    configuration: conf,
  ),
  output: '@0@.desktop'.format(application_id),
  type: 'desktop',
  po_dir: '../po',
  install: true,
  install_dir: datadir / 'applications',
)

desktop_file_validate = find_program('desktop-file-validate', required: false)
if desktop_file_validate.found()
  test('Validate desktop file', desktop_file_validate, args: [desktop_file])
endif

appstream_file = i18n.merge_file(
  input: configure_file(
    input: 'com.mardojai.ForgeSparks.metainfo.xml.in.in',
    output: 'com.mardojai.ForgeSparks.metainfo.xml.in',
    configuration: conf,
  ),
  output: '@0@.metainfo.xml'.format(application_id),
  po_dir: '../po',
  install: true,
  install_dir: datadir / 'metainfo',
)

appstreamcli = find_program('appstreamcli', required: false)
if appstreamcli.found()
  test(
    'Validate appstream file',
    appstreamcli,
    args: ['validate', '--no-net', '--explain', appstream_file],
    workdir: meson.current_build_dir(),
  )
endif

configure_file(
  input: 'com.mardojai.ForgeSparks.gschema.xml',
  output: '@0@.gschema.xml'.format(application_id),
  configuration: conf,
  install: true,
  install_dir: datadir / 'glib-2.0/schemas',
)

compile_schemas = find_program('glib-compile-schemas', required: false)
if compile_schemas.found()
  test(
    'Validate schema file',
    compile_schemas,
    args: ['--strict', '--dry-run', meson.current_source_dir()],
  )
endif

configure_file(
  input: 'com.mardojai.ForgeSparks.service.in',
  output: '@0@.service'.format(application_id),
  configuration: conf,
  install_dir: datadir / 'dbus-1/services',
)

install_data(
  '@0@.svg'.format(application_id),
  install_dir: datadir / 'icons/hicolor/scalable/apps',
)

install_data(
  'com.mardojai.ForgeSparks-symbolic.svg',
  install_dir: datadir / 'icons/hicolor/symbolic/apps',
  rename: '@0@-symbolic.svg'.format(application_id),
)
