# Local preview only. GitHub Pages builds this site with its own pinned
# toolchain, so this file exists purely so `bundle exec jekyll serve` runs the
# same versions Pages will use.
#
#   bundle install
#   bundle exec jekyll serve --livereload
source 'https://rubygems.org'

gem 'github-pages', group: :jekyll_plugins

# Windows and JRuby need these explicitly.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem 'tzinfo', '>= 1', '< 3'
  gem 'tzinfo-data'
end
gem 'wdm', '~> 0.1', platforms: [:mingw, :x64_mingw, :mswin]
gem 'webrick', '~> 1.8'
