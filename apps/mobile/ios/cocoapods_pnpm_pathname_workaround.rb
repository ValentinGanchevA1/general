# CocoaPods <= 1.17.0 can intermittently raise `pathname contains null byte`
# while generating Pods.xcodeproj for local pods reached through pnpm symlinks.
# Upstream tracking: CocoaPods/CocoaPods#12798 and #12866.
#
# Keep CocoaPods' normal `realdirpath` behavior whenever it succeeds. Only the
# exact upstream failure falls back to `cleanpath`, avoiding symlink resolution
# for project-group generation while preserving the relative group layout.

require 'rubygems'

module NexaCocoaPodsPnpmPathnameWorkaround
  def group_for_path_in_group(absolute_pathname, group, reflect_file_system_structure, base_path = nil)
    unless absolute_pathname.absolute?
      raise ArgumentError, "Paths must be absolute #{absolute_pathname}"
    end
    unless base_path.nil? || base_path.absolute?
      raise ArgumentError, "Paths must be absolute #{base_path}"
    end

    relative_base =
      if base_path.nil?
        group.real_path
      else
        begin
          base_path.realdirpath
        rescue ArgumentError => error
          raise unless error.message == 'pathname contains null byte'

          Pod::UI.warn(
            '[NEXA iOS] CocoaPods pnpm pathname workaround: using cleanpath for a local pod group.',
          )
          base_path.cleanpath
        end
      end

    relative_pathname = absolute_pathname.relative_path_from(relative_base)
    relative_dir = relative_pathname.dirname

    if reflect_file_system_structure
      path = relative_base
      relative_dir.each_filename do |name|
        break if name.to_s.downcase.include? '.lproj'
        next if name == '.'

        path += name
        group = group.children.find { |child| child.display_name == name } || group.new_group(name, path)
      end
      return group
    end

    group
  end
end

if Gem::Version.new(Pod::VERSION) <= Gem::Version.new('1.17.0')
  Pod::Project.prepend(NexaCocoaPodsPnpmPathnameWorkaround)
end
