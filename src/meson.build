blueprint_compiler = find_program('blueprint-compiler')
gjspack = find_program('../troll/gjspack/bin/gjspack')
custom_target(
  'gjspack',
  input: ['main.js', '../po/POTFILES'],
  output: application_id + '.src.gresource',
  command: [
    gjspack,
    '--appid=' + application_id,
    '--project-root', meson.project_source_root(),
    '--resource-root', meson.project_source_root() / 'src',
    '--blueprint-compiler', blueprint_compiler,
    '--no-executable', '@INPUT0@',
    '--potfiles', '@INPUT1@',
    '@OUTDIR@',
  ],
  install: true,
  install_dir: pkgdatadir,
  build_always_stale: true,
)

bin_conf = configuration_data()
bin_conf.set('GJS', find_program('gjs').full_path())
bin_conf.set('version', version)
bin_conf.set('profile', profile)
bin_conf.set('app_id', application_id)
bin_conf.set('prefix', prefix)
bin_conf.set('libdir', libdir)
bin_conf.set('datadir', datadir)

configure_file(
  input: 'com.mardojai.ForgeSparks',
  output: application_id,
  configuration: bin_conf,
  install: true,
  install_dir: pkgdatadir,
)

subdir('icons')
