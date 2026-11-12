Pod::Spec.new do |s|
  s.name           = 'KeyCommands'
  s.version        = '1.0.0'
  s.summary        = 'Keyboard shortcuts on iPad'
  s.description    = 'Hardware keyboard shortcuts (⌘F, ⌘N) for the app, shown when ⌘ is held.'
  s.author         = 'SALFORD'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
