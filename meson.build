project('forge-sparks',
  version: '0.2.0',
  meson_version: '>= 0.63.0',
  license: 'GPL-3.0'
)

if get_option('profile') == 'development'
  profile = 'Devel'
  vcs_tag = run_command('git', 'rev-parse', '--short', 'HEAD', check: true).stdout().strip()
  if vcs_tag == ''
    version_suffix = '-devel'
  else
    version_suffix = '-@0@'.format (vcs_tag)
  endif
else
  profile = ''
  version_suffix = ''
endif

application_id = 'com.mardojai.ForgeSparks@0@'.format(profile)
version =  meson.project_version() + version_suffix

prefix = get_option('prefix')
bindir = prefix / get_option('bindir')
libdir = prefix / get_option('libdir')
datadir = prefix / get_option('datadir')
pkgdatadir = datadir / application_id

gnome = import('gnome')
i18n = import('i18n')

subdir('data')
subdir('src')
subdir('po')

install_symlink(
  meson.project_name(),
  pointing_to: pkgdatadir / application_id,
  install_dir: bindir
)

gnome.post_install(
  glib_compile_schemas: true,
  gtk_update_icon_cache: true,
  update_desktop_database: true
)
